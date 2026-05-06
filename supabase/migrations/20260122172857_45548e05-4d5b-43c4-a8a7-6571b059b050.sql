-- Add class_id to grades table for proper class-specific data
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

-- Add class_id to lessons table for proper class-specific data  
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grades_class_id ON public.grades(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_class_id ON public.lessons(class_id);
