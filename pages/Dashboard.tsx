import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, ClipboardList, MessageSquare, TrendingUp, Plus, ArrowRight } from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  totalLessons: number;
  totalGrades: number;
  averageGrade: number;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalLessons: 0,
    totalGrades: 0,
    averageGrade: 0,
  });
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch counts
        const [studentsRes, lessonsRes, gradesRes] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('grades').select('percentage').eq('teacher_id', user.id),
        ]);

        const totalStudents = studentsRes.count || 0;
        const totalLessons = lessonsRes.count || 0;
        const grades = gradesRes.data || [];
        const totalGrades = grades.length;
        const averageGrade = grades.length > 0
          ? grades.reduce((acc, g) => acc + (g.percentage || 0), 0) / grades.length
          : 0;

        setStats({ totalStudents, totalLessons, totalGrades, averageGrade });

        // Fetch recent students
        const { data: students } = await supabase
          .from('students')
          .select('*')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentStudents(students || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const firstName = user?.user_metadata?.first_name || 'Teacher';

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      href: '/students',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Lesson Plans',
      value: stats.totalLessons,
      icon: BookOpen,
      href: '/lessons',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Grades Recorded',
      value: stats.totalGrades,
      icon: ClipboardList,
      href: '/grades',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Average Grade',
      value: `${stats.averageGrade.toFixed(1)}%`,
      icon: TrendingUp,
      href: '/grades',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your classroom today.
            </p>
          </div>
          <Link to="/assistant">
            <Button className="gradient-primary hover:opacity-90 gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat with AI Assistant
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Link key={stat.title} to={stat.href}>
              <Card className="hover:shadow-soft transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold mt-1">{loading ? '...' : stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions & Recent Students */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/students" className="block">
                <Button variant="outline" className="w-full justify-between h-auto py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Add New Student</p>
                      <p className="text-xs text-muted-foreground">Track student progress</p>
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/lessons" className="block">
                <Button variant="outline" className="w-full justify-between h-auto py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <BookOpen className="h-5 w-5 text-accent" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Create Lesson Plan</p>
                      <p className="text-xs text-muted-foreground">Organize your curriculum</p>
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </Button>
              </Link>
              <Link to="/grades" className="block">
                <Button variant="outline" className="w-full justify-between h-auto py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <ClipboardList className="h-5 w-5 text-success" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Record Grades</p>
                      <p className="text-xs text-muted-foreground">Enter student assessments</p>
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Students */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Students</CardTitle>
                <CardDescription>Your most recently added students</CardDescription>
              </div>
              <Link to="/students">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3">
                      <div className="h-10 w-10 bg-secondary rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-secondary rounded w-24" />
                        <div className="h-3 bg-secondary rounded w-16 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentStudents.length > 0 ? (
                <div className="space-y-3">
                  {recentStudents.map((student) => (
                    <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {student.first_name[0]}{student.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{student.first_name} {student.last_name}</p>
                        <p className="text-xs text-muted-foreground">{student.grade_level || 'No grade level'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No students yet</p>
                  <Link to="/students">
                    <Button variant="link" size="sm" className="mt-2">
                      Add your first student
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
