-- Create storage bucket for student assignments (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-assignments', 'student-assignments', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for assignment uploads (idempotent)
DROP POLICY IF EXISTS "Teachers can upload assignments" ON storage.objects;
CREATE POLICY "Teachers can upload assignments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-assignments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teachers can view their assignments" ON storage.objects;
CREATE POLICY "Teachers can view their assignments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-assignments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teachers can delete their assignments" ON storage.objects;
CREATE POLICY "Teachers can delete their assignments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-assignments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create extensions + RAG/rubric/submissions tables + match_chunks function
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  source_table text,
  source_id uuid,
  title text,
  chunk_text text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_l2_ops)
  with (lists = 100);

create table if not exists rubrics (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  name text not null,
  rubric jsonb not null,
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  student_id uuid,
  assignment_id uuid,
  filename text,
  content text,
  created_at timestamptz default now(),
  feedback jsonb
);

create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int,
  teacher_uuid uuid
)
returns table (
  id uuid,
  title text,
  chunk_text text,
  embedding vector(1536),
  distance float
)
language sql stable as $$
  select id, title, chunk_text, embedding, (embedding <-> query_embedding) as distance
  from document_chunks
  where teacher_id = teacher_uuid
  order by embedding <-> query_embedding
  limit match_count;
$$;


-- Create table to track student assignment submissions
CREATE TABLE IF NOT EXISTS public.student_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Teachers can view their assignments" ON public.student_assignments;
CREATE POLICY "Teachers can view their assignments"
ON public.student_assignments FOR SELECT
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can insert assignments" ON public.student_assignments;
CREATE POLICY "Teachers can insert assignments"
ON public.student_assignments FOR INSERT
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update their assignments" ON public.student_assignments;
CREATE POLICY "Teachers can update their assignments"
ON public.student_assignments FOR UPDATE
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their assignments" ON public.student_assignments;
CREATE POLICY "Teachers can delete their assignments"
ON public.student_assignments FOR DELETE
USING (auth.uid() = teacher_id);

-- Index for performance
CREATE INDEX idx_student_assignments_class ON public.student_assignments(class_id);
CREATE INDEX idx_student_assignments_student ON public.student_assignments(student_id);
