import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, GraduationCap, Search, Trash2, Edit, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Class {
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
  grade_level: string | null;
}

interface StudentClass {
  student_id: string;
  class_id: string;
}

const Classes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentClasses, setStudentClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [description, setDescription] = useState('');

  const fetchData = async () => {
    if (!user) return;

    try {
      const [classesRes, studentsRes, studentClassesRes] = await Promise.all([
        supabase.from('classes').select('*').eq('teacher_id', user.id).order('name'),
        supabase.from('students').select('id, first_name, last_name, grade_level').eq('teacher_id', user.id).order('last_name'),
        supabase.from('student_classes').select('student_id, class_id'),
      ]);

      if (classesRes.error) throw classesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (studentClassesRes.error) throw studentClassesRes.error;

      setClasses(classesRes.data || []);
      setStudents(studentsRes.data || []);
      setStudentClasses(studentClassesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const resetForm = () => {
    setName('');
    setSubject('');
    setGradeLevel('');
    setDescription('');
    setEditingClass(null);
  };

  const handleOpenDialog = (cls?: Class) => {
    if (cls) {
      setEditingClass(cls);
      setName(cls.name);
      setSubject(cls.subject || '');
      setGradeLevel(cls.grade_level || '');
      setDescription(cls.description || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleOpenAssignDialog = (cls: Class) => {
    setSelectedClass(cls);
    const classStudentIds = studentClasses
      .filter(sc => sc.class_id === cls.id)
      .map(sc => sc.student_id);
    setSelectedStudents(classStudentIds);
    setIsAssignDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update({
            name,
            subject: subject || null,
            grade_level: gradeLevel || null,
            description: description || null,
          })
          .eq('id', editingClass.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Class updated successfully' });
      } else {
        const { error } = await supabase
          .from('classes')
          .insert({
            teacher_id: user.id,
            name,
            subject: subject || null,
            grade_level: gradeLevel || null,
            description: description || null,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Class created successfully' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving class:', error);
      toast({ title: 'Error', description: 'Failed to save class', variant: 'destructive' });
    }
  };

  const handleAssignStudents = async () => {
    if (!selectedClass) return;

    try {
      // Get current assignments for this class
      const currentAssignments = studentClasses.filter(sc => sc.class_id === selectedClass.id);
      const currentStudentIds = currentAssignments.map(sc => sc.student_id);

      // Find students to add and remove
      const toAdd = selectedStudents.filter(id => !currentStudentIds.includes(id));
      const toRemove = currentStudentIds.filter(id => !selectedStudents.includes(id));

      // Remove unselected students
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('student_classes')
          .delete()
          .eq('class_id', selectedClass.id)
          .in('student_id', toRemove);
        if (error) throw error;
      }

      // Add new students
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('student_classes')
          .insert(toAdd.map(studentId => ({
            student_id: studentId,
            class_id: selectedClass.id,
          })));
        if (error) throw error;
      }

      toast({ title: 'Success', description: 'Students assigned successfully' });
      setIsAssignDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error assigning students:', error);
      toast({ title: 'Error', description: 'Failed to assign students', variant: 'destructive' });
    }
  };

  const handleDelete = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;

    try {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Class deleted successfully' });
      fetchData();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast({ title: 'Error', description: 'Failed to delete class', variant: 'destructive' });
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getStudentCount = (classId: string) =>
    studentClasses.filter(sc => sc.class_id === classId).length;

  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground mt-1">Organize students into classes</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" />
                Create Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Create New Class'}</DialogTitle>
                <DialogDescription>
                  {editingClass ? 'Update class information' : 'Set up a new class for your students'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Class Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., Period 1 Math" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="History">History</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="Music">Music</SelectItem>
                        <SelectItem value="Physical Education">Physical Education</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeLevel">Grade Level</Label>
                    <Input id="gradeLevel" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="e.g., 10th Grade" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the class..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="gradient-primary">{editingClass ? 'Update' : 'Create Class'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search classes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-48 bg-secondary rounded-lg" />
            ))}
          </div>
        ) : filteredClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.map((cls) => (
              <Card 
                key={cls.id} 
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/classes/${cls.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 gradient-primary rounded-lg">
                        <GraduationCap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">{cls.name}</CardTitle>
                        {cls.subject && <Badge variant="secondary" className="mt-1">{cls.subject}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(cls)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(cls.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cls.grade_level && <p className="text-sm text-muted-foreground">{cls.grade_level}</p>}
                  {cls.description && <p className="text-sm line-clamp-2">{cls.description}</p>}
                  <div className="flex items-center justify-between pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {getStudentCount(cls.id)} students
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(cls)}>
                      Assign Students
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">No classes yet</h3>
              <p className="text-muted-foreground mb-4">Create your first class to organize students</p>
              <Button onClick={() => handleOpenDialog()} className="gradient-primary gap-2">
                <Plus className="h-4 w-4" />
                Create Class
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Assign Students Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Students to {selectedClass?.name}</DialogTitle>
              <DialogDescription>Select students to add to this class</DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {students.length > 0 ? (
                students.map((student) => (
                  <div key={student.id} className="flex items-center gap-3 p-2 rounded hover:bg-secondary">
                    <Checkbox
                      id={student.id}
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => toggleStudent(student.id)}
                    />
                    <label htmlFor={student.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{student.first_name} {student.last_name}</span>
                      {student.grade_level && (
                        <span className="text-sm text-muted-foreground ml-2">({student.grade_level})</span>
                      )}
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No students available. Add students first.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
              <Button className="gradient-primary" onClick={handleAssignStudents}>
                Save ({selectedStudents.length} selected)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Classes;
