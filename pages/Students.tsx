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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Search, Trash2, Edit } from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  grade_level: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

const Students = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [notes, setNotes] = useState('');

  const fetchStudents = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', user.id)
        .order('last_name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'Failed to load students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setGradeLevel('');
    setNotes('');
    setEditingStudent(null);
  };

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFirstName(student.first_name);
      setLastName(student.last_name);
      setEmail(student.email || '');
      setGradeLevel(student.grade_level || '');
      setNotes(student.notes || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update({
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            grade_level: gradeLevel || null,
            notes: notes || null,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Student updated successfully' });
      } else {
        const { error } = await supabase
          .from('students')
          .insert({
            teacher_id: user.id,
            first_name: firstName,
            last_name: lastName,
            email: email || null,
            grade_level: gradeLevel || null,
            notes: notes || null,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Student added successfully' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      toast({
        title: 'Error',
        description: 'Failed to save student',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Student deleted successfully' });
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete student',
        variant: 'destructive',
      });
    }
  };

  const filteredStudents = students.filter((student) =>
    `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground mt-1">
              Manage your students and track their progress
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
                <DialogDescription>
                  {editingStudent ? 'Update student information' : 'Enter the student details below'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gradeLevel">Grade Level (Optional)</Label>
                  <Input
                    id="gradeLevel"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g., 10th Grade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes about the student..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-primary">
                    {editingStudent ? 'Update' : 'Add Student'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student List
            </CardTitle>
            <CardDescription>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-12 bg-secondary rounded" />
                ))}
              </div>
            ) : filteredStudents.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Grade Level</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {student.first_name[0]}{student.last_name[0]}
                              </span>
                            </div>
                            {student.first_name} {student.last_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {student.email || '—'}
                        </TableCell>
                        <TableCell>{student.grade_level || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(student)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(student.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No students yet</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding your first student
                </p>
                <Button onClick={() => handleOpenDialog()} className="gradient-primary gap-2">
                  <Plus className="h-4 w-4" />
                  Add Student
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Students;
