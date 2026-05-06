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
import { useToast } from '@/hooks/use-toast';
import { Plus, BookOpen, Search, Trash2, Edit, Calendar } from 'lucide-react';
import { format } from 'date-fns';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Lesson {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  description: string | null;
  objectives: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

interface ClassOption {
  id: string;
  name: string;
}

const Lessons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [content, setContent] = useState('');
  const [classId, setClassId] = useState('');

  const fetchLessons = async () => {
    if (!user) return;
    
    try {
      const [lessonsRes, classesRes] = await Promise.all([
        supabase
          .from('lessons')
          .select('*')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id)
          .order('name'),
      ]);

      if (lessonsRes.error) throw lessonsRes.error;
      if (classesRes.error) throw classesRes.error;
      
      setLessons(lessonsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lessons',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, [user]);

  const resetForm = () => {
    setTitle('');
    setSubject('');
    setGradeLevel('');
    setDescription('');
    setObjectives('');
    setContent('');
    setClassId('');
    setEditingLesson(null);
  };

  const handleOpenDialog = (lesson?: Lesson) => {
    if (lesson) {
      setEditingLesson(lesson);
      setTitle(lesson.title);
      setSubject(lesson.subject || '');
      setGradeLevel(lesson.grade_level || '');
      setDescription(lesson.description || '');
      setObjectives(lesson.objectives || '');
      setContent(lesson.content || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingLesson) {
        const { error } = await supabase
          .from('lessons')
          .update({
            title,
            subject: subject || null,
            grade_level: gradeLevel || null,
            description: description || null,
            objectives: objectives || null,
            content: content || null,
            class_id: classId && classId !== 'none' ? classId : null,
          })
          .eq('id', editingLesson.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Lesson updated successfully' });
      } else {
        const { error } = await supabase
          .from('lessons')
          .insert({
            teacher_id: user.id,
            title,
            subject: subject || null,
            grade_level: gradeLevel || null,
            description: description || null,
            objectives: objectives || null,
            content: content || null,
            class_id: classId && classId !== 'none' ? classId : null,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Lesson created successfully' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchLessons();
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast({
        title: 'Error',
        description: 'Failed to save lesson',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;

    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;
      toast({ title: 'Success', description: 'Lesson deleted successfully' });
      fetchLessons();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lesson',
        variant: 'destructive',
      });
    }
  };

  const filteredLessons = lessons.filter((lesson) =>
    lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lesson.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Lessons</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage your lesson plans
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" />
                Create Lesson
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLesson ? 'Edit Lesson' : 'Create New Lesson'}</DialogTitle>
                <DialogDescription>
                  {editingLesson ? 'Update your lesson plan' : 'Fill in the details for your lesson plan'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Lesson Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Introduction to Algebra"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Mathematics"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lessonGradeLevel">Grade Level</Label>
                    <Input
                      id="lessonGradeLevel"
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                      placeholder="e.g., 9th Grade"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief overview of the lesson..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objectives">Learning Objectives</Label>
                  <Textarea
                    id="objectives"
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    placeholder="What students will learn..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lessonClass">Class (Optional)</Label>
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
                  <Label htmlFor="content">Lesson Content</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Detailed lesson content, activities, and instructions..."
                    rows={6}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-primary">
                    {editingLesson ? 'Update Lesson' : 'Create Lesson'}
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
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Lessons Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-48 bg-secondary rounded-lg" />
            ))}
          </div>
        ) : filteredLessons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLessons.map((lesson) => (
              <Card key={lesson.id} className="hover:shadow-soft transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <BookOpen className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(lesson)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(lesson.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-3">{lesson.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-xs">
                    {lesson.subject && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{lesson.subject}</span>}
                    {lesson.grade_level && <span>{lesson.grade_level}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {lesson.description || 'No description provided'}
                  </p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(lesson.created_at), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="py-12">
            <CardContent className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">No lessons yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first lesson plan to get started
              </p>
              <Button onClick={() => handleOpenDialog()} className="gradient-primary gap-2">
                <Plus className="h-4 w-4" />
                Create Lesson
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Lessons;
