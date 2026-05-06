-- Create profiles table for teachers
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  school TEXT,
  subject TEXT,
  grade_level TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  grade_level TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade_level TEXT,
  description TEXT,
  objectives TEXT,
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create grades table
CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  assignment TEXT NOT NULL,
  grade DECIMAL(5,2) NOT NULL,
  max_points DECIMAL(5,2) DEFAULT 100,
  percentage DECIMAL(5,2),
  feedback TEXT,
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create AI conversations table for chat history
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Students policies
DROP POLICY IF EXISTS "Teachers can view their own students" ON public.students;
CREATE POLICY "Teachers can view their own students" ON public.students
  FOR SELECT USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can insert their own students" ON public.students;
CREATE POLICY "Teachers can insert their own students" ON public.students
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update their own students" ON public.students;
CREATE POLICY "Teachers can update their own students" ON public.students
  FOR UPDATE USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own students" ON public.students;
CREATE POLICY "Teachers can delete their own students" ON public.students
  FOR DELETE USING (auth.uid() = teacher_id);

-- Lessons policies
DROP POLICY IF EXISTS "Teachers can view their own lessons" ON public.lessons;
CREATE POLICY "Teachers can view their own lessons" ON public.lessons
  FOR SELECT USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can insert their own lessons" ON public.lessons;
CREATE POLICY "Teachers can insert their own lessons" ON public.lessons
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update their own lessons" ON public.lessons;
CREATE POLICY "Teachers can update their own lessons" ON public.lessons
  FOR UPDATE USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own lessons" ON public.lessons;
CREATE POLICY "Teachers can delete their own lessons" ON public.lessons
  FOR DELETE USING (auth.uid() = teacher_id);

-- Grades policies
DROP POLICY IF EXISTS "Teachers can view their own grades" ON public.grades;
CREATE POLICY "Teachers can view their own grades" ON public.grades
  FOR SELECT USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can insert their own grades" ON public.grades;
CREATE POLICY "Teachers can insert their own grades" ON public.grades
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update their own grades" ON public.grades;
CREATE POLICY "Teachers can update their own grades" ON public.grades
  FOR UPDATE USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own grades" ON public.grades;
CREATE POLICY "Teachers can delete their own grades" ON public.grades
  FOR DELETE USING (auth.uid() = teacher_id);

-- AI conversations policies
DROP POLICY IF EXISTS "Teachers can view their own conversations" ON public.ai_conversations;
CREATE POLICY "Teachers can view their own conversations" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can insert their own conversations" ON public.ai_conversations;
CREATE POLICY "Teachers can insert their own conversations" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own conversations" ON public.ai_conversations;
CREATE POLICY "Teachers can delete their own conversations" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = teacher_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON public.lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
