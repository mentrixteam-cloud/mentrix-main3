-- Core "Assignments + Rubric + Submissions" schema (idempotent)
-- Teachers create class assignments, optionally attach a rubric file, and upload per-student submissions.

-- 1) Storage bucket for rubric files
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-rubrics', 'assignment-rubrics', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (match the pattern used in other migrations: first folder is teacher UUID)
DROP POLICY IF EXISTS "Teachers can upload assignment rubrics" ON storage.objects;
CREATE POLICY "Teachers can upload assignment rubrics"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-rubrics'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teachers can view their assignment rubrics" ON storage.objects;
CREATE POLICY "Teachers can view their assignment rubrics"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-rubrics'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Teachers can delete their assignment rubrics" ON storage.objects;
CREATE POLICY "Teachers can delete their assignment rubrics"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assignment-rubrics'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2) Class assignments (template)
CREATE TABLE IF NOT EXISTS public.class_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their class assignments" ON public.class_assignments;
CREATE POLICY "Teachers can view their class assignments"
ON public.class_assignments FOR SELECT
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can manage their class assignments" ON public.class_assignments;
CREATE POLICY "Teachers can manage their class assignments"
ON public.class_assignments FOR ALL
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_class_assignments_class ON public.class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_teacher ON public.class_assignments(teacher_id);

-- 3) Rubric metadata per assignment (file + optional extracted content)
CREATE TABLE IF NOT EXISTS public.assignment_rubrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  class_assignment_id UUID REFERENCES public.class_assignments(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  extracted_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assignment_rubrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their assignment rubrics" ON public.assignment_rubrics;
CREATE POLICY "Teachers can view their assignment rubrics"
ON public.assignment_rubrics FOR SELECT
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can manage their assignment rubrics" ON public.assignment_rubrics;
CREATE POLICY "Teachers can manage their assignment rubrics"
ON public.assignment_rubrics FOR ALL
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_assignment ON public.assignment_rubrics(class_assignment_id);

-- 4) Link submissions to a class assignment (add nullable FK)
ALTER TABLE public.student_assignments
ADD COLUMN IF NOT EXISTS class_assignment_id UUID REFERENCES public.class_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_assignments_class_assignment ON public.student_assignments(class_assignment_id);

