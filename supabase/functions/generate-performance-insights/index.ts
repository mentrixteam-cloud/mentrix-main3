// @ts-nocheck
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

    // Analyze student performance
    const insights: any[] = [];

    // 1. Find students falling behind (declining trend or consistently low)
    const { data: allGrades } = await supabaseService
      .from("grades")
      .select("*, students(id, first_name, last_name)")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (allGrades) {
      // Group by student
      const studentGrades = new Map<string, any[]>();
      allGrades.forEach((grade: any) => {
        const studentId = grade.student_id;
        if (!studentGrades.has(studentId)) {
          studentGrades.set(studentId, []);
        }
        studentGrades.get(studentId)!.push(grade);
      });

      // Analyze each student
      for (const [studentId, grades] of studentGrades.entries()) {
        if (grades.length < 3) continue; // Need at least 3 grades for trend

        const recentGrades = grades.slice(0, 5); // Last 5 assignments
        const olderGrades = grades.slice(5, 10); // Previous 5

        const recentAvg = recentGrades.reduce((sum, g) => sum + (g.percentage || 0), 0) / recentGrades.length;
        const olderAvg = olderGrades.length > 0
          ? olderGrades.reduce((sum, g) => sum + (g.percentage || 0), 0) / olderGrades.length
          : recentAvg;

        const decline = olderAvg - recentAvg;
        const student = grades[0].students;

        // Student falling behind (declining by 5%+ or consistently below 60%)
        if (decline > 5 || (recentAvg < 60 && recentGrades.length >= 3)) {
          insights.push({
            teacher_id: teacherId,
            insight_type: "student_falling_behind",
            priority: decline > 10 || recentAvg < 50 ? "critical" : decline > 5 ? "high" : "medium",
            student_id: studentId,
            title: `${student?.first_name} ${student?.last_name} is ${decline > 5 ? "falling behind" : "struggling"}`,
            description: decline > 5
              ? `Performance has declined by ${decline.toFixed(1)}% over recent assignments. Current average: ${recentAvg.toFixed(1)}%`
              : `Consistently performing below 60% (current average: ${recentAvg.toFixed(1)}%)`,
            recommendation: decline > 10
              ? "Immediate intervention recommended. Schedule a meeting with the student and consider additional support resources."
              : "Review recent assignments to identify specific areas of difficulty. Consider one-on-one support or differentiated instruction.",
            data_snapshot: {
              recent_average: recentAvg,
              older_average: olderAvg,
              decline: decline,
              assignment_count: recentGrades.length,
            },
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          });
        }
      }

      // 2. Find failing concepts (topics with low average scores)
      const { data: gradesBySubject } = await supabaseService
        .from("grades")
        .select("subject, percentage, assignment")
        .eq("teacher_id", teacherId)
        .not("subject", "is", null);

      if (gradesBySubject) {
        const conceptScores = new Map<string, number[]>();
        gradesBySubject.forEach((grade: any) => {
          const concept = grade.subject || "General";
          if (!conceptScores.has(concept)) {
            conceptScores.set(concept, []);
          }
          conceptScores.get(concept)!.push(grade.percentage || 0);
        });

        for (const [concept, scores] of conceptScores.entries()) {
          if (scores.length < 3) continue;
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          const belowThreshold = scores.filter(s => s < 70).length;

          // Concept failing if average < 70% and >50% of students below threshold
          if (avg < 70 && belowThreshold / scores.length > 0.5) {
            insights.push({
              teacher_id: teacherId,
              insight_type: "concept_failing",
              priority: avg < 60 ? "high" : "medium",
              subject: concept,
              title: `${concept} needs attention`,
              description: `Average score is ${avg.toFixed(1)}% with ${belowThreshold} out of ${scores.length} assignments below 70%`,
              recommendation: `Consider reteaching this concept. Review common mistakes and provide additional practice materials.`,
              data_snapshot: {
                average_score: avg,
                below_threshold_count: belowThreshold,
                total_assignments: scores.length,
              },
              expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
            });
          }
        }
      }

      // 3. Intervention needed (students with multiple failing grades)
      for (const [studentId, grades] of studentGrades.entries()) {
        const failingCount = grades.filter(g => (g.percentage || 0) < 60).length;
        const recentFailing = grades.slice(0, 3).filter(g => (g.percentage || 0) < 60).length;

        if (recentFailing >= 2 || failingCount >= 3) {
          const student = grades[0].students;
          const avg = grades.slice(0, 5).reduce((sum, g) => sum + (g.percentage || 0), 0) / Math.min(5, grades.length);

          insights.push({
            teacher_id: teacherId,
            insight_type: "intervention_needed",
            priority: recentFailing >= 2 ? "critical" : "high",
            student_id: studentId,
            title: `Intervention needed: ${student?.first_name} ${student?.last_name}`,
            description: `${recentFailing >= 2 ? "Multiple recent" : "Multiple"} failing grades detected. Current average: ${avg.toFixed(1)}%`,
            recommendation: "Immediate action required. Contact parents/guardians, schedule intervention meeting, and develop support plan.",
            data_snapshot: {
              failing_count: failingCount,
              recent_failing: recentFailing,
              current_average: avg,
            },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          });
        }
      }
    }

    // Save insights to database
    if (insights.length > 0) {
      const { error: insertError } = await supabaseService
        .from("performance_insights")
        .insert(insights);

      if (insertError) {
        console.error("Error inserting insights:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        insights_generated: insights.length,
        insights: insights.map(i => ({
          type: i.insight_type,
          priority: i.priority,
          title: i.title,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-insights error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
