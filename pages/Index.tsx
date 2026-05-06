import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, BookOpen, BarChart3, Bot, ArrowRight, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite_0.5s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_1s]" />
      </div>

      {/* Header */}
      <header className="container mx-auto px-4 py-6 animate-fade-in">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2 hover-scale cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <GraduationCap className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold text-foreground">Mentrix</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="hover-scale">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button className="hover-scale shadow-lg shadow-primary/25">Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in border border-primary/20">
            <Sparkles className="h-4 w-4 animate-[pulse_2s_ease-in-out_infinite]" />
            <span>AI-Powered Education Platform</span>
          </div>
          
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl animate-fade-in [animation-delay:100ms]">
            Your AI-Powered
            <span className="block text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-fade-in [animation-delay:200ms]">
              Teaching Assistant
            </span>
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl animate-fade-in [animation-delay:300ms]">
            Streamline lesson planning, track student progress, and get intelligent insights — all in one powerful platform built for educators.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in [animation-delay:400ms]">
            <Link to="/auth">
              <Button size="lg" className="gap-2 hover-scale shadow-xl shadow-primary/30 group">
                Start Free 
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="hover-scale">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto mt-24 grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Student Management"
            description="Track and organize all your students in one centralized dashboard."
            delay={0}
          />
          <FeatureCard
            icon={<BookOpen className="h-6 w-6" />}
            title="Lesson Planning"
            description="Create, organize, and share lesson plans with powerful templates."
            delay={100}
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="Grade Tracking"
            description="Record grades and monitor student performance over time."
            delay={200}
          />
          <FeatureCard
            icon={<Bot className="h-6 w-6" />}
            title="AI Assistant"
            description="Get intelligent suggestions and automate routine tasks."
            delay={300}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground animate-fade-in [animation-delay:600ms]">
        <p>© 2026 Mentrix. Built for educators, by educators.</p>
      </footer>
    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) => (
  <div 
    className="rounded-2xl border bg-card/80 backdrop-blur-sm p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 animate-fade-in group"
    style={{ animationDelay: `${500 + delay}ms` }}
  >
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/25">
      {icon}
    </div>
    <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default Index;
