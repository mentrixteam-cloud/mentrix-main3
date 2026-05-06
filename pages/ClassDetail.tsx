import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import RecordGradeDialog from '@/components/class/RecordGradeDialog';
import UploadAssignmentDialog from '@/components/class/UploadAssignmentDialog';
import AIFeedbackDialog from '@/components/assignment/AIFeedbackDialog';
import CreateAssignmentDialog from '@/components/class/CreateAssignmentDialog';
import PreviewSubmissionDialog from '@/components/class/PreviewSubmissionDialog';
import AssignmentSubmissionsDialog from '@/components/class/AssignmentSubmissionsDialog';
import {
  ArrowLeft,
  Users,
  BookOpen,
  ClipboardList,
  CalendarDays,
  TrendingUp,
  GraduationCap,
  Plus,
  Upload,
  FileText,
  Download,
  Trash2,
  Sparkles,
  Eye,
  ExternalLink,
} from 'lucide-react';

interface ClassData {
  id: string;
  name: string;
  subject: string | null;
  grade_level: string | null;
  description: string | null;
  created_at: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  grade_level: string | null;
}

interface Grade {
  id: string;
  assignment: string;
  grade: number;
  max_points: number;
  percentage: number | null;
  created_at: string;
  students: { first_name: string; last_name: string } | null;
}

interface Lesson {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  description: string | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  class_assignment_id?: string | null;
  submitted_at: string;
  students: { first_name: string; last_name: string } | null;
}

interface ClassAssignment {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  due_date: string | null;
}

const ClassDetail = () => {
  const params = useParams();
  const classId = params.classId as string | undefined;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [classData, setClassData] = useState(null as ClassData | null);
  const [students, setStudents] = useState([] as Student[]);
  const [grades, setGrades] = useState([] as Grade[]);
  const [lessons, setLessons] = useState([] as Lesson[]);
  const [events, setEvents] = useState([] as CalendarEvent[]);
  const [assignments, setAssignments] = useState([] as Assignment[]);
  const [classAssignments, setClassAssignments] = useState([] as ClassAssignment[]);
  const [loading, setLoading] = useState(true);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [createAssignmentDialogOpen, setCreateAssignmentDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [assignmentSubmissionsDialogOpen, setAssignmentSubmissionsDialogOpen] = useState(false);
  const [selectedClassAssignment, setSelectedClassAssignment] = useState<ClassAssignment | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null as Assignment | null);

  const fetchClassData = useCallback(async () => {
    if (!user || !classId) return;

    // Validate classId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(classId)) {
      toast({
        title: 'Error',
        description: 'Invalid class ID',
        variant: 'destructive',
      });
      navigate('/classes');
      return;
    }

    try {
      // Fetch class details
      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .eq('teacher_id', user.id)
        .single();

      if (classError) throw classError;
      setClassData(classInfo);

      // Fetch students in this class
      const { data: studentClassData, error: scError } = await supabase
        .from('student_classes')
        .select('student_id')
        .eq('class_id', classId);

      if (scError) throw scError;

      const studentIds = studentClassData?.map((sc) => sc.student_id) || [];

      if (studentIds.length > 0) {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .in('id', studentIds)
          .order('last_name');

        if (studentsError) throw studentsError;
        setStudents(studentsData || []);
      }

      // Fetch grades specifically for this class (using class_id)
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('*, students(first_name, last_name)')
        .eq('teacher_id', user.id)
        .eq('class_id', classId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (gradesError) throw gradesError;
      setGrades((gradesData as Grade[]) || []);

      // Fetch lessons specifically for this class (using class_id)
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('class_id', classId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (lessonsError) throw lessonsError;
      setLessons((lessonsData as Lesson[]) || []);

      // Fetch upcoming events for this class
      const { data: eventsData, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('class_id', classId)
        .gte('start_date', new Date().toISOString())
        .order('start_date')
        .limit(10);

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Fetch assignments for this class
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('student_assignments')
        .select('*, students(first_name, last_name)')
        .eq('teacher_id', user.id)
        .eq('class_id', classId)
        .order('submitted_at', { ascending: false })
        .limit(20);

      if (assignmentsError) throw assignmentsError;
      setAssignments((assignmentsData as unknown as Assignment[]) || []);

      // Fetch assignment templates for this class
      const { data: classAssignmentsData, error: classAssignmentsError } = await (supabase as any)
        .from('class_assignments')
        .select('id, title, description, created_at, due_date')
        .eq('teacher_id', user.id)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (classAssignmentsError) throw classAssignmentsError;
      setClassAssignments((classAssignmentsData as ClassAssignment[]) || []);
    } catch (error) {
      console.error('Error fetching class data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load class data',
        variant: 'destructive',
      });
      navigate('/classes');
    } finally {
      setLoading(false);
    }
  }, [user, classId, toast, navigate]);

  useEffect(() => {
    fetchClassData();
  }, [fetchClassData]);

  const averageGrade = grades.length > 0
    ? grades.reduce((acc, g) => acc + (g.percentage || 0), 0) / grades.length
    : 0;

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-success';
    if (percentage >= 70) return 'text-primary';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      assignment: 'bg-blue-500',
      assessment: 'bg-red-500',
      event: 'bg-primary',
      meeting: 'bg-purple-500',
      deadline: 'bg-orange-500',
    };
    return colors[type] || 'bg-primary';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!classData) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Class not found</h2>
          <Button asChild className="mt-4">
            <Link to="/classes">Back to Classes</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/classes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2 gradient-primary rounded-xl">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{classData.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {classData.subject && (
                    <Badge>{classData.subject}</Badge>
                  )}
                  {classData.grade_level && (
                    <span className="text-muted-foreground text-sm">
                      {classData.grade_level}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {classData.description && (
              <p className="text-muted-foreground mt-2 ml-14">
                {classData.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Students</p>
                  <p className="text-2xl font-bold">{students.length}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Class Average</p>
                  <p className={`text-2xl font-bold ${getGradeColor(averageGrade)}`}>
                    {grades.length > 0 ? `${averageGrade.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-success/10 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lesson Plans</p>
                  <p className="text-2xl font-bold">{lessons.length}</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl">
                  <BookOpen className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Events</p>
                  <p className="text-2xl font-bold">{events.length}</p>
                </div>
                <div className="p-3 bg-warning/10 rounded-xl">
                  <CalendarDays className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="students" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="students" className="gap-2">
              <Users className="h-4 w-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="grades" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Grades
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <FileText className="h-4 w-4" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="lessons" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Lessons
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Events
            </TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students in {classData.name}
                </CardTitle>
                <CardDescription>
                  {students.length} student{students.length !== 1 ? 's' : ''} enrolled
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors"
                      >
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {student.first_name[0]}
                            {student.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          {student.email && (
                            <p className="text-sm text-muted-foreground">
                              {student.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">No students assigned</h3>
                    <p className="text-muted-foreground">
                      Go to Classes page to assign students
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Grades Tab */}
          <TabsContent value="grades">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Recent Grades
                  </CardTitle>
                  <CardDescription>
                    Grade records for students in this class
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setGradeDialogOpen(true)}
                  className="gradient-primary gap-2"
                  disabled={students.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Record Grade
                </Button>
              </CardHeader>
              <CardContent>
                {grades.length > 0 ? (
                  <div className="space-y-3">
                    {grades.map((grade) => (
                      <div
                        key={grade.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium">{grade.assignment}</p>
                          <p className="text-sm text-muted-foreground">
                            {grade.students?.first_name} {grade.students?.last_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${getGradeColor(grade.percentage || 0)}`}>
                            {grade.percentage?.toFixed(1)}%
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {grade.grade}/{grade.max_points}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">No grades recorded</h3>
                    <p className="text-muted-foreground mb-4">
                      Record grades for students in this class
                    </p>
                    <Button
                      onClick={() => setGradeDialogOpen(true)}
                      className="gradient-primary gap-2"
                      disabled={students.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                      Record Grade
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Assignments
                  </CardTitle>
                  <CardDescription>
                    Assignment templates and student submissions
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateAssignmentDialogOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Assignment
                  </Button>
                  <Button
                    onClick={() => setAssignmentDialogOpen(true)}
                    className="gradient-primary gap-2"
                    disabled={students.length === 0}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Submission
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {classAssignments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classAssignments.map((classAssignment) => (
                      <Card
                        key={classAssignment.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedClassAssignment(classAssignment);
                          setAssignmentSubmissionsDialogOpen(true);
                        }}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{classAssignment.title}</CardTitle>
                          {classAssignment.description && (
                            <CardDescription className="line-clamp-2">
                              {classAssignment.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Created {format(parseISO(classAssignment.created_at), 'MMM d')}</span>
                            {classAssignment.due_date && (
                              <span>Due {format(parseISO(classAssignment.due_date), 'MMM d')}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">No assignments created</h3>
                    <p className="text-muted-foreground mb-4">
                      Create assignment templates for your class
                    </p>
                    <Button
                      onClick={() => setCreateAssignmentDialogOpen(true)}
                      className="gradient-primary gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Assignment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lessons Tab */}
          <TabsContent value="lessons">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Lesson Plans
                </CardTitle>
                <CardDescription>
                  {classData.subject
                    ? `Lessons for ${classData.subject}`
                    : 'All lesson plans'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lessons.length > 0 ? (
                  <div className="space-y-3">
                    {lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{lesson.title}</p>
                            {lesson.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {lesson.description}
                              </p>
                            )}
                          </div>
                          {lesson.subject && (
                            <Badge>{lesson.subject}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">No lesson plans</h3>
                    <p className="text-muted-foreground">
                      Create lesson plans for this class
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Upcoming Events
                </CardTitle>
                <CardDescription>
                  Scheduled events for this class
                </CardDescription>
              </CardHeader>
              <CardContent>
                {events.length > 0 ? (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 rounded-lg border"
                      >
                        <div
                          className={`w-1 h-12 rounded-full ${getEventTypeColor(
                            event.event_type
                          )}`}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(event.start_date), 'PPp')}
                          </p>
                        </div>
                        <Badge>{event.event_type}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">No upcoming events</h3>
                    <p className="text-muted-foreground">
                      Schedule events for this class on the Calendar page
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <RecordGradeDialog
          open={gradeDialogOpen}
          onOpenChange={setGradeDialogOpen}
          classId={classId!}
          userId={user!.id}
          students={students}
          onSuccess={fetchClassData}
        />
        <UploadAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          classId={classId!}
          userId={user!.id}
          students={students}
          classAssignments={classAssignments}
          onSuccess={fetchClassData}
        />
        <CreateAssignmentDialog
          open={createAssignmentDialogOpen}
          onOpenChange={setCreateAssignmentDialogOpen}
          classId={classId!}
          userId={user!.id}
          onSuccess={fetchClassData}
        />
        <AIFeedbackDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          assignment={selectedAssignment}
          onSuccess={fetchClassData}
        />
        <PreviewSubmissionDialog
          open={Boolean(selectedAssignment && previewDialogOpen)}
          onOpenChange={(open) => {
            if (!open) setSelectedAssignment(null);
            setPreviewDialogOpen(open);
          }}
          assignment={selectedAssignment}
        />
        <AssignmentSubmissionsDialog
          open={assignmentSubmissionsDialogOpen}
          onOpenChange={setAssignmentSubmissionsDialogOpen}
          classAssignment={selectedClassAssignment}
          onPreviewSubmission={(submission) => {
            setSelectedAssignment(submission);
            setPreviewDialogOpen(true);
          }}
          onAIFeedback={(submission) => {
            setSelectedAssignment(submission);
            setFeedbackDialogOpen(true);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default ClassDetail;
