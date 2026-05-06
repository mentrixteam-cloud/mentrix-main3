// @ts-nocheck - Deno runtime file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const teacherId = userData.user.id;
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const todos: any[] = [];

    // 1. Generate follow-up tasks for students with low grades
    const { data: lowGrades } = await supabaseService
      .from("grades")
      .select("*, students(id, first_name, last_name)")
      .eq("teacher_id", teacherId)
      .lt("percentage", 60)
      .order("created_at", { ascending: false })
      .limit(10);

    if (lowGrades) {
      const studentGroups = new Map<string, any[]>();
      lowGrades.forEach((grade: any) => {
        const studentId = grade.student_id;
        if (!studentGroups.has(studentId)) {
          studentGroups.set(studentId, []);
        }
        studentGroups.get(studentId)!.push(grade);
      });

      for (const [studentId, grades] of studentGroups.entries()) {
        const student = grades[0].students;
        const recentLow = grades.filter((g: any) => {
          const daysAgo = (Date.now() - new Date(g.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 7;
        });

        if (recentLow.length > 0) {
          todos.push({
            teacher_id: teacherId,
            title: `Follow up with ${student?.first_name} ${student?.last_name} about recent performance`,
            description: `${recentLow.length} recent assignment${recentLow.length > 1 ? 's' : ''} below 60%. Consider scheduling a meeting or providing additional support.`,
            task_type: "follow_up",
            priority: recentLow.length >= 2 ? "high" : "medium",
            related_student_id: studentId,
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
            completed_by_ai: false,
          });
        }
      }
    }

    // 2. Generate reminders for upcoming assignments/assessments
    const { data: upcomingLessons } = await supabaseService
      .from("lessons")
      .select("*")
      .eq("teacher_id", teacherId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    if (upcomingLessons && upcomingLessons.length > 0) {
      const latestLesson = upcomingLessons[0];
      todos.push({
        teacher_id: teacherId,
        title: `Review and prepare materials for: ${latestLesson.title}`,
        description: "Ensure all materials and resources are ready for this lesson.",
        task_type: "reminder",
        priority: "medium",
        related_lesson_id: latestLesson.id,
        due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        completed_by_ai: false,
      });
    }

    // 3. Generate tasks based on performance insights
    const { data: criticalInsights } = await supabaseService
      .from("performance_insights")
      .select("*")
      .eq("teacher_id", teacherId)
      .in("priority", ["high", "critical"])
      .eq("is_resolved", false)
      .eq("is_read", false)
      .limit(5);

    if (criticalInsights) {
      criticalInsights.forEach((insight: any) => {
        todos.push({
          teacher_id: teacherId,
          title: `Address: ${insight.title}`,
          description: insight.recommendation || insight.description,
          task_type: "ai_generated",
          priority: insight.priority === "critical" ? "urgent" : insight.priority,
          related_insight_id: insight.id,
          related_student_id: insight.student_id,
          related_class_id: insight.class_id,
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
          completed_by_ai: false,
        });
      });
    }

    // 4. Generate grading reminders for assignments without feedback
    const { data: ungradedAssignments } = await supabaseService
      .from("student_assignments")
      .select("*, students(first_name, last_name)")
      .eq("teacher_id", teacherId)
      .eq("feedback_status", "pending")
      .order("submitted_at", { ascending: false })
      .limit(5);

    if (ungradedAssignments && ungradedAssignments.length > 0) {
      const count = ungradedAssignments.length;
      todos.push({
        teacher_id: teacherId,
        title: `Grade ${count} pending assignment${count > 1 ? 's' : ''}`,
        description: `${count} assignment${count > 1 ? 's' : ''} waiting for feedback. Use AI feedback generation to save time.`,
        task_type: "reminder",
        priority: count >= 5 ? "high" : "medium",
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        completed_by_ai: false,
      });
    }

    // Save todos (avoid duplicates by checking existing)
    if (todos.length > 0) {
      const { data: existingTodos } = await supabaseService
        .from("teacher_todos")
        .select("title, created_at")
        .eq("teacher_id", teacherId)
        .eq("is_completed", false)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const existingTitles = new Set((existingTodos || []).map((t: any) => t.title));

      const newTodos = todos.filter(t => !existingTitles.has(t.title));

      if (newTodos.length > 0) {
        const { error: insertError } = await supabaseService
          .from("teacher_todos")
          .insert(newTodos);

        if (insertError) {
          console.error("Error inserting todos:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        todos_generated: todos.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-todos error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
