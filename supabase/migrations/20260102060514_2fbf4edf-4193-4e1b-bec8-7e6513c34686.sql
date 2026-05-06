-- Classes table for organizing students
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their own classes" ON public.classes;
CREATE POLICY "Teachers can view their own classes" ON public.classes FOR SELECT USING (auth.uid() = teacher_id);
DROP POLICY IF EXISTS "Teachers can insert their own classes" ON public.classes;
CREATE POLICY "Teachers can insert their own classes" ON public.classes FOR INSERT WITH CHECK (auth.uid() = teacher_id);
DROP POLICY IF EXISTS "Teachers can update their own classes" ON public.classes;
CREATE POLICY "Teachers can update their own classes" ON public.classes FOR UPDATE USING (auth.uid() = teacher_id);
DROP POLICY IF EXISTS "Teachers can delete their own classes" ON public.classes;
CREATE POLICY "Teachers can delete their own classes" ON public.classes FOR DELETE USING (auth.uid() = teacher_id);

-- Student-Class junction table
CREATE TABLE IF NOT EXISTS public.student_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their student_classes" ON public.student_classes;
CREATE POLICY "Teachers can view their student_classes" ON public.student_classes FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = student_classes.class_id AND classes.teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers can insert student_classes" ON public.student_classes;
CREATE POLICY "Teachers can insert student_classes" ON public.student_classes FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = student_classes.class_id AND classes.teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers can delete student_classes" ON public.student_classes;
CREATE POLICY "Teachers can delete student_classes" ON public.student_classes FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = student_classes.class_id AND classes.teacher_id = auth.uid()));

-- Teacher documents for RAG pipeline
CREATE TABLE IF NOT EXISTS public.teacher_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their own documents" ON public.teacher_documents;
CREATE POLICY "Teachers can view their own documents" ON public.teacher_documents FOR SELECT USING (auth.uid() = teacher_id);
DROP POLICY IF EXISTS "Teachers can insert their own documents" ON public.teacher_documents;
CREATE POLICY "Teachers can insert their own documents" ON public.teacher_documents FOR INSERT WITH CHECK (auth.uid() = teacher_id);
DROP POLICY IF EXISTS "Teachers can delete their own documents" ON public.teacher_documents;
CREATE POLICY "Teachers can delete their own documents" ON public.teacher_documents FOR DELETE USING (auth.uid() = teacher_id);

-- Storage bucket for teacher documents
-- Storage bucket for teacher documents (idempotent)
INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-documents', 'teacher-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Teachers can upload their own documents" ON storage.objects;
CREATE POLICY "Teachers can upload their own documents" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'teacher-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Teachers can view their own documents" ON storage.objects;
CREATE POLICY "Teachers can view their own documents" ON storage.objects FOR SELECT 
  USING (bucket_id = 'teacher-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Teachers can delete their own documents" ON storage.objects;
CREATE POLICY "Teachers can delete their own documents" ON storage.objects FOR DELETE 
  USING (bucket_id = 'teacher-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger to update updated_at on classes
DROP TRIGGER IF EXISTS update_classes_updated_at ON public.classes;
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
