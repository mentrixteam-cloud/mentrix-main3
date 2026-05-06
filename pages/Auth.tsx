import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Sparkles, BookOpen, Users } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const validateInputs = (isSignUp: boolean) => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (isSignUp && (!firstName.trim() || !lastName.trim())) {
        throw new Error('Please enter your first and last name');
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive'
        });
      } else if (error instanceof Error) {
        toast({
          title: 'Validation Error',
          description: error.message,
          variant: 'destructive'
        });
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs(false)) return;

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Sign in failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.' 
          : error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs(true)) return;

    setIsLoading(true);
    const { error } = await signUp(email, password, firstName, lastName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Account exists',
          description: 'This email is already registered. Please sign in instead.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Sign up failed',
          description: error.message,
          variant: 'destructive'
        });
      }
    } else {
      toast({
        title: 'Welcome to Mentrix!',
        description: 'Your account has been created successfully.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          <span className="text-xl font-semibold">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Mentrix</span>
        </div>
        
        <div className="space-y-8">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your AI-Powered
            <br />
            Teaching Assistant
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            Transform your teaching experience with personalized AI insights, 
            lesson planning, and student performance analytics.
          </p>
          
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <Sparkles className="h-6 w-6 text-white mb-2" />
              <h3 className="font-semibold text-white">AI Insights</h3>
              <p className="text-white/70 text-sm">Personalized recommendations</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <BookOpen className="h-6 w-6 text-white mb-2" />
              <h3 className="font-semibold text-white">Lesson Plans</h3>
              <p className="text-white/70 text-sm">Smart lesson management</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <Users className="h-6 w-6 text-white mb-2" />
              <h3 className="font-semibold text-white">Student Tracking</h3>
              <p className="text-white/70 text-sm">Performance analytics</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <GraduationCap className="h-6 w-6 text-white mb-2" />
              <h3 className="font-semibold text-white">Grade Management</h3>
              <p className="text-white/70 text-sm">Streamlined grading</p>
            </div>
          </div>
        </div>
        
        <p className="text-white/60 text-sm">
          Trusted by educators worldwide
        </p>
      </div>
      
      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-elevated border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="p-2 gradient-primary rounded-xl">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">Mentrix</span>
            </div>
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="teacher@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full gradient-primary hover:opacity-90"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="Jane"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="teacher@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full gradient-primary hover:opacity-90"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
