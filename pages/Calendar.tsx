import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { 
  Plus, 
  CalendarDays, 
  Edit2, 
  Trash2, 
  Clock, 
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  class_id: string | null;
  color: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

const EVENT_TYPES = [
  { value: 'assignment', label: 'Assignment', color: 'bg-blue-500' },
  { value: 'assessment', label: 'Assessment', color: 'bg-red-500' },
  { value: 'event', label: 'Event', color: 'bg-primary' },
  { value: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { value: 'deadline', label: 'Deadline', color: 'bg-orange-500' },
];

interface ClassOption {
  id: string;
  name: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'event',
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '10:00',
    all_day: false,
    color: '',
    class_id: '',
  });

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const [eventsRes, classesRes] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('*')
          .eq('teacher_id', user.id)
          .gte('start_date', start.toISOString())
          .lte('start_date', end.toISOString())
          .order('start_date', { ascending: true }),
        supabase
          .from('classes')
          .select('id, name')
          .eq('teacher_id', user.id)
          .order('name'),
      ]);
      
      if (eventsRes.error) throw eventsRes.error;
      if (classesRes.error) throw classesRes.error;
      
      setEvents(eventsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, toast]);

  const checkGoogleConnection = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        setGoogleConnected(true);
      }
    } catch (error) {
      console.error('Error checking Google connection:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
    checkGoogleConnection();
  }, [fetchEvents, checkGoogleConnection]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'event',
      start_date: '',
      start_time: '09:00',
      end_date: '',
      end_time: '10:00',
      all_day: false,
      color: '',
      class_id: '',
    });
    setEditingEvent(null);
  };

  const handleOpenDialog = (event?: CalendarEvent) => {
    if (event) {
      setEditingEvent(event);
      const startDate = parseISO(event.start_date);
      const endDate = event.end_date ? parseISO(event.end_date) : null;
      
      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        start_date: format(startDate, 'yyyy-MM-dd'),
        start_time: event.all_day ? '09:00' : format(startDate, 'HH:mm'),
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : '',
        end_time: endDate && !event.all_day ? format(endDate, 'HH:mm') : '10:00',
        all_day: event.all_day,
        color: event.color || '',
        class_id: event.class_id || '',
      });
    } else if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        start_date: format(selectedDate, 'yyyy-MM-dd'),
        end_date: format(selectedDate, 'yyyy-MM-dd'),
      }));
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !formData.title || !formData.start_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const startDateTime = formData.all_day 
        ? `${formData.start_date}T00:00:00`
        : `${formData.start_date}T${formData.start_time}:00`;
      
      const endDateTime = formData.end_date 
        ? (formData.all_day 
          ? `${formData.end_date}T23:59:59`
          : `${formData.end_date}T${formData.end_time}:00`)
        : null;

      const eventData = {
        teacher_id: user.id,
        title: formData.title,
        description: formData.description || null,
        event_type: formData.event_type,
        start_date: startDateTime,
        end_date: endDateTime,
        all_day: formData.all_day,
        color: formData.color || null,
        class_id: formData.class_id || null,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('calendar_events')
          .update(eventData)
          .eq('id', editingEvent.id);
        
        if (error) throw error;
        toast({
          title: "Event Updated",
          description: "Your calendar event has been updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from('calendar_events')
          .insert([eventData]);
        
        if (error) throw error;
        toast({
          title: "Event Created",
          description: "Your calendar event has been created successfully.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: "Failed to save calendar event",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
      
      if (error) throw error;
      toast({
        title: "Event Deleted",
        description: "Your calendar event has been deleted.",
      });
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete calendar event",
        variant: "destructive",
      });
    }
  };

  const handleGoogleConnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please sign in to connect Google Calendar",
          variant: "destructive",
        });
        return;
      }

      // Call the edge function to get the OAuth URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'get_auth_url' }),
        }
      );

      const data = await response.json();
      
      if (data.needsSetup) {
        toast({
          title: "Setup Required",
          description: "Google Calendar integration requires setup. Please add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to your backend secrets.",
          variant: "destructive",
        });
        return;
      }
      
      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      
      if (data.authUrl) {
        // Open Google OAuth in a popup
        const popup = window.open(data.authUrl, 'Google Calendar', 'width=500,height=600');
        
        // Listen for the callback
        const handleMessage = async (event: MessageEvent) => {
          if (event.data.type === 'google-calendar-callback' && event.data.code) {
            popup?.close();
            window.removeEventListener('message', handleMessage);
            
            // Exchange code for tokens
            const tokenResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-auth`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ 
                  action: 'exchange_code',
                  code: event.data.code,
                }),
              }
            );

            const tokenData = await tokenResponse.json();
            
            if (tokenData.success) {
              setGoogleConnected(true);
              toast({
                title: "Connected!",
                description: "Your Google Calendar is now connected.",
              });
            } else {
              throw new Error(tokenData.error || 'Failed to connect');
            }
          }
        };
        
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      console.error('Error connecting Google Calendar:', error);
      toast({
        title: "Error",
        description: "Failed to connect Google Calendar",
        variant: "destructive",
      });
    }
  };

  const handleSyncToGoogle = async () => {
    if (!googleConnected) {
      toast({
        title: "Not Connected",
        description: "Please connect your Google Calendar first",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'sync_to_google' }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Synced!",
          description: `${data.synced} events synced to Google Calendar.`,
        });
        fetchEvents();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing to Google:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync events to Google Calendar",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return;

    try {
      const { error } = await supabase
        .from('google_calendar_tokens')
        .delete()
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      setGoogleConnected(false);
      toast({
        title: "Disconnected",
        description: "Google Calendar has been disconnected.",
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect Google Calendar",
        variant: "destructive",
      });
    }
  };

  const getEventTypeColor = (type: string) => {
    const eventType = EVENT_TYPES.find(et => et.value === type);
    return eventType?.color || 'bg-primary';
  };

  const selectedDateEvents = events.filter(event => 
    selectedDate && isSameDay(parseISO(event.start_date), selectedDate)
  );

  const datesWithEvents = events.map(event => parseISO(event.start_date));

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarDays className="h-8 w-8 text-primary" />
              Calendar
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your assignments, assessments, and events
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Google Calendar Sync */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm.14 19.018c-3.868 0-7-3.14-7-7.018 0-3.878 3.132-7.018 7-7.018 1.89 0 3.47.697 4.682 1.829l-1.974 1.978v-.004c-.735-.702-1.667-1.062-2.708-1.062-2.31 0-4.187 1.956-4.187 4.273 0 2.315 1.877 4.277 4.187 4.277 2.096 0 3.522-1.202 3.816-2.852H12.14v-2.737h6.585c.088.47.135.96.135 1.474 0 4.01-2.677 6.86-6.72 6.86z"
                    />
                  </svg>
                  Google Calendar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {googleConnected ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {googleConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  
                  {!googleConnected ? (
                    <Button onClick={handleGoogleConnect} className="w-full gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Connect Google Calendar
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        onClick={handleSyncToGoogle} 
                        className="w-full gap-2"
                        disabled={syncing}
                      >
                        <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                        {syncing ? 'Syncing...' : 'Sync All Events'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleDisconnectGoogle}
                        className="w-full text-destructive"
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Sync your Mentrix events to your Google Calendar automatically.
                  </p>
                </div>
              </PopoverContent>
            </Popover>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gradient-primary hover:opacity-90 gap-2" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingEvent ? 'Edit Event' : 'Create New Event'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingEvent ? 'Update your calendar event' : 'Add a new event to your calendar'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Event title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event_type">Event Type</Label>
                    <Select 
                      value={formData.event_type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, event_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3 h-3 rounded-full", type.color)} />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Class Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="class_id">Class (Optional)</Label>
                    <Select 
                      value={formData.class_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, class_id: value === 'none' ? '' : value }))}
                    >
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

                  <div className="flex items-center gap-2">
                    <Switch
                      id="all_day"
                      checked={formData.all_day}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, all_day: checked }))}
                    />
                    <Label htmlFor="all_day">All day event</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    {!formData.all_day && (
                      <div className="space-y-2">
                        <Label htmlFor="start_time">Start Time</Label>
                        <Input
                          id="start_time"
                          type="time"
                          value={formData.start_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                    {!formData.all_day && (
                      <div className="space-y-2">
                        <Label htmlFor="end_time">End Time</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={formData.end_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add event details..."
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingEvent ? 'Update' : 'Create'} Event
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                onMonthChange={setCurrentMonth}
                className="rounded-md"
                modifiers={{
                  hasEvent: datesWithEvents,
                }}
                modifiersStyles={{
                  hasEvent: {
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                    textDecorationColor: 'hsl(var(--primary))',
                  },
                }}
              />
            </CardContent>
          </Card>

          {/* Selected Date Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
              </CardTitle>
              <CardDescription>
                {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : selectedDateEvents.length > 0 ? (
                selectedDateEvents.map(event => (
                  <div 
                    key={event.id} 
                    className="p-3 rounded-lg border hover:shadow-soft transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getEventTypeColor(event.event_type))} />
                          <span className="font-medium truncate">{event.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {event.all_day ? (
                            'All day'
                          ) : (
                            format(parseISO(event.start_date), 'h:mm a')
                          )}
                        </div>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {EVENT_TYPES.find(t => t.value === event.event_type)?.label}
                        </Badge>
                        {event.google_event_id && (
                          <Badge variant="outline" className="mt-2 ml-1 text-xs">
                            Synced
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(event)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(event.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No events on this day</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => handleOpenDialog()}
                  >
                    Add an event
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Your next scheduled events</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-secondary animate-pulse rounded-lg" />
                ))}
              </div>
            ) : events.length > 0 ? (
              <div className="space-y-2">
                {events.slice(0, 5).map(event => (
                  <div 
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-3 h-3 rounded-full", getEventTypeColor(event.event_type))} />
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(event.start_date), 'MMM d, yyyy')}
                          {!event.all_day && ` at ${format(parseISO(event.start_date), 'h:mm a')}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {EVENT_TYPES.find(t => t.value === event.event_type)?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No upcoming events</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Calendar;