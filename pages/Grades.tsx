import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, ClipboardList, Search, Trash2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface Grade {
  id: string;
  student_id: string;
  assignment: string;
  grade: number;
  max_points: number;
  percentage: number | null;
  feedback: string | null;
  subject: string | null;
  created_at: string;
  students?: Student;
}

interface ClassOption {
  id: string;
  name: string;
}

const Grades = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [studentId, setStudentId] = useState('');
  const [assignment, setAssignment] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [feedback, setFeedback] = useState('');
  const [subject, setSubject] = useState('');
  const [classId, setClassId] = useState('');

  const fetchData = async () => {
    if (!user) return;
    
    try {
      const [gradesRes, studentsRes, classesRes] = await Promise.all([
        supabase
          .from('grades')
          .select('*, students(id, first_name, last_name)')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('teacher_id', user.id)
          .order('last_name', { ascending: true }),
        supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id)
          .order('name'),
      ]);

      if (gradesRes.error) throw gradesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (classesRes.error) throw classesRes.error;

      setGrades(gradesRes.data || []);
      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load grades',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const resetForm = () => {
    setStudentId('');
    setAssignment('');
    setGradeValue('');
    setMaxPoints('100');
    setFeedback('');
    setSubject('');
    setClassId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const gradeNum = parseFloat(gradeValue);
    const maxNum = parseFloat(maxPoints);
    const percentage = (gradeNum / maxNum) * 100;

    try {
      const { error } = await supabase
        .from('grades')
        .insert({
          teacher_id: user.id,
          student_id: studentId,
          assignment,
          grade: gradeNum,
          max_points: maxNum,
          percentage,
          feedback: feedback || null,
          subject: subject || null,
          class_id: classId && classId !== 'none' ? classId : null,
        });

      if (error) throw error;
      toast({ title: 'Success', description: 'Grade recorded successfully' });
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving grade:', error);
      toast({
        title: 'Error',
        description: 'Failed to record grade',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (gradeId: string) => {
    if (!confirm('Are you sure you want to delete this grade?')) return;

    try {
      const { error } = await supabase
        .from('grades')
        .delete()
        .eq('id', gradeId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Grade deleted successfully' });
      fetchData();
    } catch (error) {
      console.error('Error deleting grade:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete grade',
        variant: 'destructive',
      });
    }
  };

  const filteredGrades = grades.filter((grade) =>
    grade.assignment.toLowerCase().includes(searchQuery.toLowerCase()) ||
    grade.students?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    grade.students?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const averageGrade = grades.length > 0
    ? grades.reduce((acc, g) => acc + (g.percentage || 0), 0) / grades.length
    : 0;

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-success';
    if (percentage >= 70) return 'text-primary';
    if (percentage >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Grades</h1>
            <p className="text-muted-foreground mt-1">
              Record and track student assessments
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary hover:opacity-90 gap-2" disabled={students.length === 0}>
                <Plus className="h-4 w-4" />
                Record Grade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record New Grade</DialogTitle>
                <DialogDescription>
                  Enter the grade details for a student assessment
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student">Student</Label>
                  <Select value={studentId} onValueChange={setStudentId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.first_name} {student.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment">Assignment Name</Label>
                  <Input
                    id="assignment"
                    value={assignment}
                    onChange={(e) => setAssignment(e.target.value)}
                    placeholder="e.g., Chapter 5 Quiz"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade">Points Earned</Label>
                    <Input
                      id="grade"
                      type="number"
                      step="0.01"
                      value={gradeValue}
                      onChange={(e) => setGradeValue(e.target.value)}
                      placeholder="e.g., 85"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPoints">Max Points</Label>
                    <Input
                      id="maxPoints"
                      type="number"
                      step="0.01"
                      value={maxPoints}
                      onChange={(e) => setMaxPoints(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gradeSubject">Subject (Optional)</Label>
                  <Input
                    id="gradeSubject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gradeClass">Class (Optional)</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No class</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback">Feedback (Optional)</Label>
                  <Textarea
                    id="feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Comments or feedback for the student..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-primary">
                    Record Grade
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Grades</p>
                  <p className="text-2xl font-bold">{grades.length}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <ClipboardList className="h-5 w-5 text-primary" />
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
                    {averageGrade.toFixed(1)}%
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
                  <p className="text-sm text-muted-foreground">Students Graded</p>
                  <p className="text-2xl font-bold">
                    {new Set(grades.map(g => g.student_id)).size}
                  </p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl">
                  <ClipboardList className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search grades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Grades Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Grade Records
            </CardTitle>
            <CardDescription>
              {filteredGrades.length} grade record{filteredGrades.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-12 bg-secondary rounded" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No students yet</h3>
                <p className="text-muted-foreground">
                  Add students first before recording grades
                </p>
              </div>
            ) : filteredGrades.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGrades.map((grade) => (
                      <TableRow key={grade.id}>
                        <TableCell className="font-medium">
                          {grade.students?.first_name} {grade.students?.last_name}
                        </TableCell>
                        <TableCell>{grade.assignment}</TableCell>
                        <TableCell>
                          {grade.grade}/{grade.max_points}
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getGradeColor(grade.percentage || 0)}`}>
                            {grade.percentage?.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(grade.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(grade.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No grades recorded</h3>
                <p className="text-muted-foreground mb-4">
                  Start recording student grades
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Record Grade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Grades;
