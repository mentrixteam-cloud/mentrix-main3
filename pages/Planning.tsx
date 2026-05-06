import React, { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  Circle,
  Plus,
  Calendar,
  Clock,
  Target,
  AlertCircle,
  Sparkles,
  Loader2,
  Trash2,
  Edit2,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface Todo {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  reminder_date: string | null;
  is_completed: boolean;
  is_archived: boolean;
  completed_at: string | null;
  related_student_id: string | null;
  related_class_id: string | null;
  related_lesson_id: string | null;
  created_at: string;
  students?: { first_name: string; last_name: string } | null;
  classes?: { name: string } | null;
  lessons?: { title: string } | null;
}

interface TodoInsert {
  teacher_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  task_type: string;
  due_date: string | null;
}

const Planning = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'all' | 'completed'>('today');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [taskType, setTaskType] = useState<'manual' | 'ai_generated' | 'reminder' | 'follow_up'>('manual');

  useEffect(() => {
    if (user) {
      fetchTodos();
      generateAITodos();
    }
  }, [user, filter]);

  const fetchTodos = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('teacher_todos')
        .select(`
          *,
          students:related_student_id (first_name, last_name),
          classes:related_class_id (name),
          lessons:related_lesson_id (title)
        `)
        .eq('teacher_id', user.id)
        .eq('is_archived', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = query
          .gte('due_date', today.toISOString())
          .lt('due_date', tomorrow.toISOString())
          .eq('is_completed', false);
      } else if (filter === 'upcoming') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query
          .gte('due_date', today.toISOString())
          .eq('is_completed', false);
      } else if (filter === 'completed') {
        query = query.eq('is_completed', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTodos(((data as unknown) as Todo[]) || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAITodos = async () => {
    if (!user) return;

    try {
      // Check if we should generate AI todos (once per day)
      const lastGeneration = localStorage.getItem(`ai_todos_generated_${user.id}`);
      const today = new Date().toDateString();
      if (lastGeneration === today) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-todos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        localStorage.setItem(`ai_todos_generated_${user.id}`, today);
        await fetchTodos();
      }
    } catch (error) {
      console.error('Error generating AI todos:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    try {
      const todoData: TodoInsert = {
        teacher_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        task_type: taskType,
        due_date: dueDate || null,
      };

      if (editingTodo) {
        const { error } = await supabase
          .from('teacher_todos')
          .update(todoData)
          .eq('id', editingTodo.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Task updated successfully' });
      } else {
        const { error } = await supabase
          .from('teacher_todos')
          .insert(todoData);

        if (error) throw error;
        toast({ title: 'Success', description: 'Task created successfully' });
      }

      resetForm();
      setDialogOpen(false);
      fetchTodos();
    } catch (error) {
      console.error('Error saving todo:', error);
      toast({
        title: 'Error',
        description: 'Failed to save task',
        variant: 'destructive',
      });
    }
  };

  const toggleComplete = async (todo: Todo) => {
    try {
      const { error } = await supabase
        .from('teacher_todos')
        .update({
          is_completed: !todo.is_completed,
          completed_at: !todo.is_completed ? new Date().toISOString() : null,
        })
        .eq('id', todo.id);

      if (error) throw error;
      fetchTodos();
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive',
      });
    }
  };

  const deleteTodo = async (id: string) => {
    if (!confirm('Delete this task?')) return;

    try {
      const { error } = await supabase
        .from('teacher_todos')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Task deleted' });
      fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setTaskType('manual');
    setEditingTodo(null);
  };

  const openEditDialog = (todo: Todo) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description || '');
    setPriority(todo.priority);
    setDueDate(todo.due_date ? format(parseISO(todo.due_date), 'yyyy-MM-dd') : '');
    setTaskType(todo.task_type as 'manual' | 'ai_generated' | 'reminder' | 'follow_up');
    setDialogOpen(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getDueDateLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM d');
  };

  const todayTodos = todos.filter(t => {
    if (!t.due_date) return false;
    return isToday(parseISO(t.due_date)) && !t.is_completed;
  });

  const overdueTodos = todos.filter(t => {
    if (!t.due_date || t.is_completed) return false;
    return isPast(parseISO(t.due_date));
  });

  const upcomingTodos = todos.filter(t => {
    if (!t.due_date || t.is_completed) return false;
    const date = parseISO(t.due_date);
    return !isPast(date) && !isToday(date);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Planning & Tasks</h1>
            <p className="text-muted-foreground mt-1">
              Centralized planning to reduce mental load and stay organized
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary gap-2">
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTodo ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  Add a task to your planning center
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Review student essays"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Additional details..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high' | 'urgent')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date (Optional)</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-primary">
                    {editingTodo ? 'Update Task' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">{todayTodos.length}</p>
                </div>
                <Calendar className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-destructive">{overdueTodos.length}</p>
                </div>
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold">{upcomingTodos.length}</p>
                </div>
                <Clock className="h-5 w-5 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-success">
                    {todos.filter(t => t.is_completed).length}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {overdueTodos.length > 0 && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-semibold text-destructive">
                    {overdueTodos.length} overdue task{overdueTodos.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Review and complete these tasks as soon as possible
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Focus */}
        {filter === 'today' && todayTodos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Today's Focus
              </CardTitle>
              <CardDescription>
                Tasks due today - prioritize these first
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
                >
                  <Checkbox
                    checked={todo.is_completed}
                    onCheckedChange={() => toggleComplete(todo)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`font-medium ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.title}
                      </p>
                      <Badge className={getPriorityColor(todo.priority)}>
                        {todo.priority}
                      </Badge>
                      {todo.task_type === 'ai_generated' && (
                        <Badge variant="outline" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                    </div>
                    {todo.description && (
                      <p className="text-sm text-muted-foreground mb-1">{todo.description}</p>
                    )}
                    {todo.students && (
                      <p className="text-xs text-muted-foreground">
                        Student: {todo.students.first_name} {todo.students.last_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(todo)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTodo(todo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* All Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>
                  {filter === 'today' && 'Tasks due today'}
                  {filter === 'upcoming' && 'Upcoming tasks'}
                  {filter === 'all' && 'All active tasks'}
                  {filter === 'completed' && 'Completed tasks'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('today')}
                >
                  Today
                </Button>
                <Button
                  variant={filter === 'upcoming' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('upcoming')}
                >
                  Upcoming
                </Button>
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'completed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('completed')}
                >
                  Completed
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-16 bg-secondary rounded" />
                ))}
              </div>
            ) : todos.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No tasks yet</h3>
                <p className="text-muted-foreground mb-4">
                  {filter === 'completed'
                    ? 'No completed tasks'
                    : 'Create your first task to get started'}
                </p>
                {filter !== 'completed' && (
                  <Button onClick={() => setDialogOpen(true)} className="gradient-primary gap-2">
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {todos.map((todo) => {
                  const dueDateLabel = getDueDateLabel(todo.due_date);
                  return (
                    <div
                      key={todo.id}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg border transition-colors
                        ${todo.is_completed ? 'opacity-60' : 'hover:bg-secondary/50'}
                        ${dueDateLabel === 'Overdue' ? 'border-destructive bg-destructive/5' : ''}
                      `}
                    >
                      <Checkbox
                        checked={todo.is_completed}
                        onCheckedChange={() => toggleComplete(todo)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-medium ${todo.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                            {todo.title}
                          </p>
                          <Badge className={getPriorityColor(todo.priority)}>
                            {todo.priority}
                          </Badge>
                          {todo.task_type === 'ai_generated' && (
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI
                            </Badge>
                          )}
                          {dueDateLabel && (
                            <Badge variant={dueDateLabel === 'Overdue' ? 'destructive' : 'secondary'}>
                              {dueDateLabel}
                            </Badge>
                          )}
                        </div>
                        {todo.description && (
                          <p className="text-sm text-muted-foreground mb-1">{todo.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {todo.students && (
                            <span>Student: {todo.students.first_name} {todo.students.last_name}</span>
                          )}
                          {todo.classes && <span>Class: {todo.classes.name}</span>}
                          {todo.lessons && <span>Lesson: {todo.lessons.title}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!todo.is_completed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(todo)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTodo(todo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Planning;
