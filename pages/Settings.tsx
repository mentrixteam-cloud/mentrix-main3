import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { User, Save, Loader2 } from 'lucide-react';

interface Profile {
  first_name: string | null;
  last_name: string | null;
  school: string | null;
  subject: string | null;
  grade_level: string | null;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile>({
    first_name: '',
    last_name: '',
    school: '',
    subject: '',
    grade_level: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, school, subject, grade_level')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setProfile({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            school: data.school || '',
            subject: data.subject || '',
            grade_level: data.grade_level || '',
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          school: profile.school || null,
          subject: profile.subject || null,
          grade_level: profile.grade_level || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal and teaching information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-10 bg-secondary rounded" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profile.first_name || ''}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profile.last_name || ''}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Teaching Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="school">School</Label>
                    <Input
                      id="school"
                      value={profile.school || ''}
                      onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                      placeholder="e.g., Lincoln High School"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={profile.subject || ''}
                        onChange={(e) => setProfile({ ...profile, subject: e.target.value })}
                        placeholder="e.g., Mathematics"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gradeLevel">Grade Level</Label>
                      <Input
                        id="gradeLevel"
                        value={profile.grade_level || ''}
                        onChange={(e) => setProfile({ ...profile, grade_level: e.target.value })}
                        placeholder="e.g., 9-12"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="gradient-primary gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
