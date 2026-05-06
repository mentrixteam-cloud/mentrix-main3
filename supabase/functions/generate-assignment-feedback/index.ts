// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isRateLimited } from "../lib/rateLimiter.ts";

//const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const ALLOWED_ORIGIN = "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

interface FeedbackRequest {
  assignment_id: string;
  assignment_content?: string;
  assignment_title?: string;
  student_name?: string;
  rubric_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Respond to preflight quickly without performing imports or env lookups.
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: FeedbackRequest = await req.json().catch(() => ({}));
    const { assignment_id, assignment_content, assignment_title, student_name, rubric_id } = payload;

    if (!assignment_id) {
      return new Response(
        JSON.stringify({ error: "assignment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Dynamic import to avoid fetching remote module at module load time
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");

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

    // Rate limiting
    const userKey = `feedback-generation:user:${teacherId}`;
    if (await isRateLimited(supabaseService, { key: userKey, limit: 50, windowSeconds: 60 })) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch assignment details
    const { data: assignment, error: assignmentError } = await supabaseService
      .from("student_assignments")
      .select(`
        *,
        students:student_id (first_name, last_name, grade_level),
        classes:class_id (name, subject)
      `)
      .eq("id", assignment_id)
      .eq("teacher_id", teacherId)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: "Assignment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const student = assignment.students as any;
    const studentFullName = student ? `${student.first_name} ${student.last_name}` : student_name || "Student";
    const classInfo = assignment.classes as any;
    const subject = classInfo?.subject || "General";

    // Get assignment content (use provided or fetch from storage)
    let contentToAnalyze = assignment_content || assignment.extracted_content || "";
    
    if (!contentToAnalyze && assignment.file_path) {
      // Try to fetch file content from storage
      try {
        const { data: fileData } = await supabaseService.storage
          .from("student-assignments")
          .download(assignment.file_path);
        
        if (fileData) {
          // For text files, read content
          if (assignment.file_type?.includes("text") || assignment.file_name?.endsWith(".txt")) {
            contentToAnalyze = await fileData.text();
          } else {
            contentToAnalyze = `File: ${assignment.file_name} (${assignment.file_type || "unknown type"})`;
          }
        }
      } catch (e) {
        console.error("Error fetching file content:", e);
      }
    }

    // Get rubric if provided
    let rubricContext = "";

    // 1) Explicit rubric_id path (supports the "premium_features" rubric schema)
    if (rubric_id) {
      const { data: rubric } = await supabaseService
        .from("rubrics")
        .select(
          `
          *,
          criteria:rubric_criteria (
            *,
            levels:rubric_levels (*)
          )
        `,
        )
        .eq("id", rubric_id)
        .eq("teacher_id", teacherId)
        .single();

      if (rubric) {
        rubricContext = `\n## Rubric: ${rubric.name}\n`;
        const criteria = (rubric as any).criteria as any[];
        if (Array.isArray(criteria)) {
          criteria.forEach((criterion: any) => {
            rubricContext += `\n### ${criterion.name} (${criterion.max_points} points)\n`;
            rubricContext += `${criterion.description || ""}\n`;
            const levels = criterion.levels as any[];
            if (Array.isArray(levels)) {
              levels.forEach((level: any) => {
                rubricContext += `- ${level.level_name} (${level.points} pts): ${level.description || ""}\n`;
              });
            }
          });
        }
      }
    }

    // 2) If the submission is linked to a class assignment, pull rubric file context
    // (supports the "assignment_rubrics" file-based rubric we added).
    if (!rubricContext && assignment.class_assignment_id) {
      const { data: rubricFile } = await supabaseService
        .from("assignment_rubrics" as any)
        .select("*")
        .eq("teacher_id", teacherId)
        .eq("class_assignment_id", assignment.class_assignment_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rubricFile) {
        let rubricText = rubricFile.extracted_content || "";
        if (!rubricText && rubricFile.file_path) {
          try {
            const { data: fileData } = await supabaseService.storage
              .from("assignment-rubrics")
              .download(rubricFile.file_path);

            if (fileData) {
              if (
                rubricFile.file_type?.includes("text") ||
                rubricFile.file_name?.endsWith(".txt")
              ) {
                rubricText = await fileData.text();
              } else {
                rubricText = `Rubric file: ${rubricFile.file_name} (${rubricFile.file_type || "unknown type"})`;
              }
            }
          } catch (e) {
            console.error("Error fetching rubric file:", e);
          }
        }

        if (rubricText) {
          rubricContext = `\n## Rubric (attached)\n${rubricText}\n`;
        }
      }
    }

    // Get student's recent performance context
    const { data: recentGrades } = await supabaseService
      .from("grades")
      .select("assignment, percentage, feedback, created_at")
      .eq("student_id", assignment.student_id)
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(5);

    let performanceContext = "";
    if (recentGrades && recentGrades.length > 0) {
      performanceContext = "\n## Student's Recent Performance\n";
      recentGrades.forEach((grade: any) => {
        performanceContext += `- ${grade.assignment}: ${grade.percentage?.toFixed(1)}%`;
        if (grade.feedback) {
          performanceContext += ` - ${grade.feedback.substring(0, 100)}`;
        }
        performanceContext += "\n";
      });
    }

    // Build AI prompt
    const systemPrompt = `You are Mentrix AI, an expert teaching assistant specializing in providing constructive, actionable feedback on student assignments.

Your role is to help teachers save time by generating high-quality, personalized feedback that:
1. Identifies specific strengths in the student's work
2. Provides clear, actionable improvement suggestions
3. Maintains an encouraging, growth-oriented tone
4. Is specific and references the actual work (not generic)

${rubricContext ? `\n## Rubric to Follow\n${rubricContext}` : ""}

${performanceContext ? `\n## Student Context\n${performanceContext}` : ""}

Generate feedback in this format:
- **Draft Feedback**: A comprehensive paragraph (3-5 sentences) that the teacher can edit
- **Strengths**: 2-4 specific things the student did well
- **Improvements**: 2-4 specific, actionable suggestions for improvement

Be specific, reference the actual work, and maintain a supportive tone.`;

    const userPrompt = `Generate feedback for this assignment:

**Student**: ${studentFullName}
**Assignment**: ${assignment.title || assignment_title || "Assignment"}
**Subject**: ${subject}
${assignment.description ? `**Description**: ${assignment.description}\n` : ""}

**Assignment Content**:
${contentToAnalyze || "Content not available for analysis. Please provide feedback based on the assignment title and description."}

Generate comprehensive feedback following the format specified.`;

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!AI_GATEWAY_API_KEY && !OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "AI backend not configured. Set AI_GATEWAY_API_KEY or OPENAI_API_KEY in Supabase function secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await (async () => {
      if (AI_GATEWAY_API_KEY) {
        return await fetch("https://ai.gateway.mentrix.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
          }),
        });
      }

      // OpenAI fallback (standard + easy to configure on Supabase)
      return await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });
    })();

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI provider error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI provider error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices?.[0]?.message?.content || "";

    // Parse AI response to extract structured feedback
    // Try to extract strengths and improvements if structured
    const strengths: string[] = [];
    const improvements: string[] = [];
    let draftFeedback = aiContent;

    // Try to parse structured format
    const strengthsMatch = aiContent.match(/\*\*Strengths?\*\*:?\s*([\s\S]*?)(?=\*\*|$)/i);
    const improvementsMatch = aiContent.match(/\*\*Improvements?\*\*:?\s*([\s\S]*?)(?=\*\*|$)/i);
    const draftMatch = aiContent.match(/\*\*Draft Feedback\*\*:?\s*([\s\S]*?)(?=\*\*|$)/i);

    if (draftMatch) {
      draftFeedback = draftMatch[1].trim();
    }

    if (strengthsMatch) {
      const strengthsText = strengthsMatch[1].trim();
      strengths.push(...strengthsText.split(/\n[-•]\s*/).filter(s => s.trim()).map(s => s.replace(/^[-•]\s*/, "").trim()));
    }

    if (improvementsMatch) {
      const improvementsText = improvementsMatch[1].trim();
      improvements.push(...improvementsText.split(/\n[-•]\s*/).filter(s => s.trim()).map(s => s.replace(/^[-•]\s*/, "").trim()));
    }

    // If parsing failed, use the full content as draft and try to extract lists
    if (strengths.length === 0 || improvements.length === 0) {
      const lines = aiContent.split("\n");
      let currentSection = "";
      
      for (const line of lines) {
        if (line.toLowerCase().includes("strength")) {
          currentSection = "strengths";
        } else if (line.toLowerCase().includes("improvement") || line.toLowerCase().includes("suggestion")) {
          currentSection = "improvements";
        } else if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
          const item = line.replace(/^[-•]\s*/, "").trim();
          if (currentSection === "strengths" && item) {
            strengths.push(item);
          } else if (currentSection === "improvements" && item) {
            improvements.push(item);
          }
        }
      }
    }

    // Save feedback to database
    const { data: feedbackRecord, error: feedbackError } = await supabaseService
      .from("assignment_feedback")
      .insert({
        assignment_id: assignment_id,
        teacher_id: teacherId,
        student_id: assignment.student_id,
        ai_draft_feedback: draftFeedback,
        ai_strengths: strengths.length > 0 ? strengths : null,
        ai_improvements: improvements.length > 0 ? improvements : null,
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("Error saving feedback:", feedbackError);
      // Still return the feedback even if DB save fails
    }

    // Update assignment status
    await supabaseService
      .from("student_assignments")
      .update({ feedback_status: "ai_generated" })
      .eq("id", assignment_id);

    return new Response(
      JSON.stringify({
        success: true,
        feedback: {
          id: feedbackRecord?.id,
          draft_feedback: draftFeedback,
          strengths: strengths,
          improvements: improvements,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-feedback error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
