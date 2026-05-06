-- Create calendar_events table for storing teacher events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'event', -- 'assignment', 'assessment', 'event', 'meeting', 'deadline'
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN NOT NULL DEFAULT false,
  class_id UUID, -- Optional class reference
  color TEXT,
  google_event_id TEXT, -- For synced events
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Create policies for calendar events
DROP POLICY IF EXISTS "Teachers can view their own calendar events" ON public.calendar_events;
CREATE POLICY "Teachers can view their own calendar events" 
ON public.calendar_events 
FOR SELECT 
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can create their own calendar events" ON public.calendar_events;
CREATE POLICY "Teachers can create their own calendar events" 
ON public.calendar_events 
FOR INSERT 
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can update their own calendar events" ON public.calendar_events;
CREATE POLICY "Teachers can update their own calendar events" 
ON public.calendar_events 
FOR UPDATE 
USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers can delete their own calendar events" ON public.calendar_events;
CREATE POLICY "Teachers can delete their own calendar events" 
ON public.calendar_events 
FOR DELETE 
USING (auth.uid() = teacher_id);

-- Create or replace the function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create google_calendar_tokens table to store OAuth tokens
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for google calendar tokens
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can view their own tokens" 
ON public.google_calendar_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can insert their own tokens" 
ON public.google_calendar_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can update their own tokens" 
ON public.google_calendar_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.google_calendar_tokens;
CREATE POLICY "Users can delete their own tokens" 
ON public.google_calendar_tokens 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_google_calendar_tokens_updated_at ON public.google_calendar_tokens;
CREATE TRIGGER update_google_calendar_tokens_updated_at
BEFORE UPDATE ON public.google_calendar_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
