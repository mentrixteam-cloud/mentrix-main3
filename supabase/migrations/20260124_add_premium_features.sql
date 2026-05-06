-- Migration: Add premium features for $14.99 tier
-- Features: Assignment feedback, rubrics, performance insights, to-dos, differentiated materials

-- ============================================
-- 1. ASSIGNMENT FEEDBACK SYSTEM
-- ============================================
CREATE TABLE public.assignment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.student_assignments(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  
  -- AI-generated content
  ai_draft_feedback TEXT NOT NULL,
  ai_strengths TEXT[],
  ai_improvements TEXT[],
  
  -- Teacher-edited final version
  final_feedback TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  
  -- Metadata
  grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_assignment_feedback_assignment ON public.assignment_feedback(assignment_id);
CREATE INDEX idx_assignment_feedback_teacher ON public.assignment_feedback(teacher_id);
CREATE INDEX idx_assignment_feedback_student ON public.assignment_feedback(student_id);

ALTER TABLE public.assignment_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their assignment feedback"
  ON public.assignment_feedback FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can insert their assignment feedback"
  ON public.assignment_feedback FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their assignment feedback"
  ON public.assignment_feedback FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their assignment feedback"
  ON public.assignment_feedback FOR DELETE
  USING (auth.uid() = teacher_id);

-- ============================================
-- 2. RUBRIC SYSTEM
-- ============================================
CREATE TABLE public.rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_points DECIMAL(5,2) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.rubric_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id UUID REFERENCES public.rubric_criteria(id) ON DELETE CASCADE NOT NULL,
  level_name TEXT NOT NULL, -- e.g., "Exemplary", "Proficient", "Developing"
  points DECIMAL(5,2) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE public.rubric_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE NOT NULL,
  rubric_id UUID REFERENCES public.rubrics(id) ON DELETE CASCADE NOT NULL,
  criterion_scores JSONB NOT NULL, -- {criterion_id: {level_id, points, notes}}
  total_score DECIMAL(5,2) NOT NULL,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_rubrics_teacher ON public.rubrics(teacher_id);
CREATE INDEX idx_rubric_criteria_rubric ON public.rubric_criteria(rubric_id);
CREATE INDEX idx_rubric_levels_criterion ON public.rubric_levels(criterion_id);
CREATE INDEX idx_rubric_grades_grade ON public.rubric_grades(grade_id);

ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_grades ENABLE ROW LEVEL SECURITY;

-- Rubrics policies
CREATE POLICY "Teachers can manage their rubrics"
  ON public.rubrics FOR ALL
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage rubric criteria"
  ON public.rubric_criteria FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics 
      WHERE rubrics.id = rubric_criteria.rubric_id 
      AND rubrics.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage rubric levels"
  ON public.rubric_levels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rubric_criteria
      JOIN public.rubrics ON rubrics.id = rubric_criteria.rubric_id
      WHERE rubric_criteria.id = rubric_levels.criterion_id
      AND rubrics.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage rubric grades"
  ON public.rubric_grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grades
      WHERE grades.id = rubric_grades.grade_id
      AND grades.teacher_id = auth.uid()
    )
  );

-- ============================================
-- 3. PERFORMANCE INSIGHTS & ALERTS
-- ============================================
CREATE TABLE public.performance_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  insight_type TEXT NOT NULL, -- 'student_falling_behind', 'concept_failing', 'intervention_needed', 'trend_alert'
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Context data
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject TEXT,
  concept TEXT,
  
  -- Insight details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  data_snapshot JSONB, -- Store relevant data for the insight
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_action TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE -- Auto-expire old insights
);

CREATE INDEX idx_performance_insights_teacher ON public.performance_insights(teacher_id);
CREATE INDEX idx_performance_insights_student ON public.performance_insights(student_id);
CREATE INDEX idx_performance_insights_class ON public.performance_insights(class_id);
CREATE INDEX idx_performance_insights_priority ON public.performance_insights(priority, is_read, is_resolved);
CREATE INDEX idx_performance_insights_type ON public.performance_insights(insight_type);

ALTER TABLE public.performance_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their performance insights"
  ON public.performance_insights FOR ALL
  USING (auth.uid() = teacher_id);

-- ============================================
-- 4. TO-DO & PLANNING SYSTEM
-- ============================================
CREATE TABLE public.teacher_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL, -- 'manual', 'ai_generated', 'reminder', 'follow_up'
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Context
  related_student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  related_class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  related_lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  related_grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE,
  related_insight_id UUID REFERENCES public.performance_insights(id) ON DELETE CASCADE,
  
  -- Scheduling
  due_date TIMESTAMP WITH TIME ZONE,
  reminder_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_completed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_by_ai BOOLEAN DEFAULT false -- Track if AI auto-completed
);

CREATE INDEX idx_teacher_todos_teacher ON public.teacher_todos(teacher_id);
CREATE INDEX idx_teacher_todos_due_date ON public.teacher_todos(due_date, is_completed);
CREATE INDEX idx_teacher_todos_priority ON public.teacher_todos(priority, is_completed);
CREATE INDEX idx_teacher_todos_type ON public.teacher_todos(task_type);

ALTER TABLE public.teacher_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their todos"
  ON public.teacher_todos FOR ALL
  USING (auth.uid() = teacher_id);

-- ============================================
-- 5. DIFFERENTIATED MATERIALS
-- ============================================
CREATE TABLE public.differentiated_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  
  -- Material details
  level TEXT NOT NULL CHECK (level IN ('remediation', 'on_level', 'extension')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  objectives TEXT[],
  activities TEXT[],
  resources TEXT[],
  
  -- AI generation metadata
  is_ai_generated BOOLEAN DEFAULT true,
  generation_prompt TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_differentiated_materials_lesson ON public.differentiated_materials(lesson_id);
CREATE INDEX idx_differentiated_materials_teacher ON public.differentiated_materials(teacher_id);
CREATE INDEX idx_differentiated_materials_level ON public.differentiated_materials(level);

ALTER TABLE public.differentiated_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their differentiated materials"
  ON public.differentiated_materials FOR ALL
  USING (auth.uid() = teacher_id);

-- ============================================
-- 6. UPDATE EXISTING TABLES
-- ============================================
-- Add class_id to grades if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'grades' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE public.grades ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
    CREATE INDEX idx_grades_class ON public.grades(class_id);
  END IF;
END $$;

-- Add feedback_status to student_assignments
ALTER TABLE public.student_assignments 
ADD COLUMN IF NOT EXISTS feedback_status TEXT DEFAULT 'pending' CHECK (feedback_status IN ('pending', 'ai_generated', 'reviewing', 'approved', 'sent'));

-- Add content extraction for assignments (for AI processing)
ALTER TABLE public.student_assignments 
ADD COLUMN IF NOT EXISTS extracted_content TEXT,
ADD COLUMN IF NOT EXISTS content_extracted_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 7. TRIGGERS
-- ============================================
-- Update timestamps
CREATE TRIGGER update_assignment_feedback_updated_at
  BEFORE UPDATE ON public.assignment_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rubrics_updated_at
  BEFORE UPDATE ON public.rubrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rubric_grades_updated_at
  BEFORE UPDATE ON public.rubric_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teacher_todos_updated_at
  BEFORE UPDATE ON public.teacher_todos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_differentiated_materials_updated_at
  BEFORE UPDATE ON public.differentiated_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================
-- Function to calculate student performance trend
CREATE OR REPLACE FUNCTION public.calculate_student_trend(
  p_student_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  trend TEXT,
  average_change DECIMAL,
  assignment_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_grades AS (
    SELECT 
      percentage,
      created_at,
      LAG(percentage) OVER (ORDER BY created_at) as prev_percentage
    FROM public.grades
    WHERE student_id = p_student_id
      AND created_at >= NOW() - (p_days_back || ' days')::INTERVAL
    ORDER BY created_at
  ),
  trend_data AS (
    SELECT 
      AVG(percentage - COALESCE(prev_percentage, percentage)) as avg_change,
      COUNT(*) as count
    FROM recent_grades
    WHERE prev_percentage IS NOT NULL
  )
  SELECT 
    CASE 
      WHEN avg_change > 2 THEN 'improving'
      WHEN avg_change < -2 THEN 'declining'
      ELSE 'stable'
    END::TEXT as trend,
    COALESCE(avg_change, 0) as average_change,
    COALESCE(count, 0)::INTEGER as assignment_count
  FROM trend_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
