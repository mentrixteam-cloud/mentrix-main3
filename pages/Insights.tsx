import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  BookOpen,
  Target,
  ArrowRight,
  X,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface PerformanceInsight {
  id: string;
  insight_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  student_id: string | null;
  class_id: string | null;
  subject: string | null;
  concept: string | null;
  title: string;
  description: string;
  recommendation: string | null;
  data_snapshot: unknown;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  students?: { first_name: string; last_name: string } | null;
  classes?: { name: string } | null;
}

const Insights = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user, filter]);

  const fetchInsights = async () => {
    if (!user) return;

    try {
      let query = (supabase as any)
        .from('performance_insights')
        .select(`
          *,
          students:student_id (first_name, last_name),
          classes:class_id (name)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'critical') {
        query = query.in('priority', ['high', 'critical']).eq('is_resolved', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInsights((data as PerformanceInsight[]) || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast({
        title: 'Error',
        description: 'Failed to load insights',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      // Call a Supabase function to analyze and generate insights
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-performance-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      toast({
        title: 'Insights Generated',
        description: 'New performance insights have been analyzed and added.',
      });

      await fetchInsights();
    } catch (error) {
      console.error('Error generating insights:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate insights',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const markAsRead = async (insightId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('performance_insights')
        .update({ is_read: true })
        .eq('id', insightId);

      if (error) throw error;
      await fetchInsights();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const resolveInsight = async (insightId: string, action?: string) => {
    try {
      const { error } = await (supabase as any)
        .from('performance_insights')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_action: action || 'Resolved by teacher',
        })
        .eq('id', insightId);

      if (error) throw error;
      toast({
        title: 'Insight Resolved',
        description: 'This insight has been marked as resolved.',
      });
      await fetchInsights();
    } catch (error) {
      console.error('Error resolving insight:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve insight',
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'student_falling_behind':
        return TrendingDown;
      case 'concept_failing':
        return BookOpen;
      case 'intervention_needed':
        return AlertTriangle;
      default:
        return Target;
    }
  };

  const filteredInsights = insights.filter(insight => {
    if (filter === 'unread') return !insight.is_read;
    if (filter === 'critical') return ['high', 'critical'].includes(insight.priority) && !insight.is_resolved;
    return true;
  });

  const unreadCount = insights.filter(i => !i.is_read).length;
  const criticalCount = insights.filter(i => ['high', 'critical'].includes(i.priority) && !i.is_resolved).length;

  const groupedInsights = {
    falling_behind: filteredInsights.filter(i => i.insight_type === 'student_falling_behind'),
    failing_concepts: filteredInsights.filter(i => i.insight_type === 'concept_failing'),
    intervention: filteredInsights.filter(i => i.insight_type === 'intervention_needed'),
    other: filteredInsights.filter(i => !['student_falling_behind', 'concept_failing', 'intervention_needed'].includes(i.insight_type)),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Performance Insights</h1>
            <p className="text-muted-foreground mt-1">
              Actionable insights to help you make data-driven decisions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={generateInsights}
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Generate Insights
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Insights</p>
                  <p className="text-2xl font-bold">{insights.length}</p>
                </div>
                <Target className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold">{unreadCount}</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold">{criticalCount}</p>
                </div>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold">
                    {insights.filter(i => i.is_resolved).length}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All Insights</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="critical">
              Critical {criticalCount > 0 && `(${criticalCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-6 mt-6">
            {/* Students Falling Behind */}
            {groupedInsights.falling_behind.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    Students Falling Behind
                  </CardTitle>
                  <CardDescription>
                    Students showing declining performance or at risk
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedInsights.falling_behind.map((insight) => {
                    const Icon = getInsightIcon(insight.insight_type);
                    return (
                      <div
                        key={insight.id}
                        className={`
                          p-4 rounded-lg border-2 transition-all
                          ${!insight.is_read ? 'border-primary bg-primary/5' : 'border-border'}
                          ${insight.is_resolved ? 'opacity-60' : ''}
                        `}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="h-4 w-4 text-destructive" />
                              <Badge className={getPriorityColor(insight.priority)}>
                                {insight.priority}
                              </Badge>
                              {!insight.is_read && (
                                <Badge variant="outline" className="border-primary text-primary">
                                  New
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold mb-1">{insight.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {insight.description}
                            </p>
                            {insight.students && (
                              <p className="text-sm font-medium mb-2">
                                Student: {insight.students.first_name} {insight.students.last_name}
                              </p>
                            )}
                            {insight.recommendation && (
                              <div className="mt-3 p-3 bg-secondary rounded-lg">
                                <p className="text-sm font-medium mb-1">Recommendation:</p>
                                <p className="text-sm">{insight.recommendation}</p>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(insight.created_at), 'PPp')}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {!insight.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(insight.id)}
                              >
                                Mark Read
                              </Button>
                            )}
                            {!insight.is_resolved && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resolveInsight(insight.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                            )}
                            {insight.student_id && (
                              <Link to={`/students`}>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  View Student
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Failing Concepts */}
            {groupedInsights.failing_concepts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-warning" />
                    Concepts Needing Attention
                  </CardTitle>
                  <CardDescription>
                    Topics or concepts where multiple students are struggling
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedInsights.failing_concepts.map((insight) => {
                    const Icon = getInsightIcon(insight.insight_type);
                    return (
                      <div
                        key={insight.id}
                        className={`
                          p-4 rounded-lg border-2 transition-all
                          ${!insight.is_read ? 'border-primary bg-primary/5' : 'border-border'}
                          ${insight.is_resolved ? 'opacity-60' : ''}
                        `}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="h-4 w-4 text-warning" />
                              <Badge className={getPriorityColor(insight.priority)}>
                                {insight.priority}
                              </Badge>
                              {insight.concept && (
                                <Badge variant="secondary">{insight.concept}</Badge>
                              )}
                            </div>
                            <h3 className="font-semibold mb-1">{insight.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {insight.description}
                            </p>
                            {insight.recommendation && (
                              <div className="mt-3 p-3 bg-secondary rounded-lg">
                                <p className="text-sm font-medium mb-1">Action Plan:</p>
                                <p className="text-sm">{insight.recommendation}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {!insight.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(insight.id)}
                              >
                                Mark Read
                              </Button>
                            )}
                            {!insight.is_resolved && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resolveInsight(insight.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Intervention Needed */}
            {groupedInsights.intervention.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Intervention Required
                  </CardTitle>
                  <CardDescription>
                    Students who need immediate support or intervention
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedInsights.intervention.map((insight) => {
                    const Icon = getInsightIcon(insight.insight_type);
                    return (
                      <div
                        key={insight.id}
                        className={`
                          p-4 rounded-lg border-2 border-destructive transition-all
                          ${!insight.is_read ? 'bg-destructive/5' : 'bg-background'}
                          ${insight.is_resolved ? 'opacity-60' : ''}
                        `}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="h-4 w-4 text-destructive" />
                              <Badge className={getPriorityColor(insight.priority)}>
                                {insight.priority}
                              </Badge>
                            </div>
                            <h3 className="font-semibold mb-1">{insight.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {insight.description}
                            </p>
                            {insight.students && (
                              <p className="text-sm font-medium mb-2">
                                Student: {insight.students.first_name} {insight.students.last_name}
                              </p>
                            )}
                            {insight.recommendation && (
                              <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                                <p className="text-sm font-medium mb-1 text-destructive">
                                  Immediate Action Required:
                                </p>
                                <p className="text-sm">{insight.recommendation}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {!insight.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(insight.id)}
                              >
                                Mark Read
                              </Button>
                            )}
                            {!insight.is_resolved && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => resolveInsight(insight.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                            )}
                            {insight.student_id && (
                              <Link to={`/students`}>
                                <Button variant="outline" size="sm" className="gap-1">
                                  View Student
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Other Insights */}
            {groupedInsights.other.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Other Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {groupedInsights.other.map((insight) => (
                    <div key={insight.id} className="p-4 rounded-lg border">
                      <h3 className="font-semibold mb-1">{insight.title}</h3>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {filteredInsights.length === 0 && !loading && (
              <Card>
                <CardContent className="text-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No insights yet</h3>
                  <p className="text-muted-foreground mb-4">
                    {filter === 'all'
                      ? 'Generate insights to get actionable recommendations'
                      : `No ${filter} insights at this time`}
                  </p>
                  <Button onClick={generateInsights} className="gradient-primary gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Generate Insights
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Insights;
