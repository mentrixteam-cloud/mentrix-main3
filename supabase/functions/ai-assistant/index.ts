// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRateLimited } from "../lib/rateLimiter.ts";

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
    const payload = await req.json().catch(() => ({}));
    const messages = payload?.messages;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate token by calling auth.getUser with a client that includes the Authorization header.
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = userData.user;
    const teacherId = user.id;

    // Rate-limit per-user and per-ip
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userKey = `ai-assistant:user:${teacherId}`;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ipKey = `ai-assistant:ip:${ip}`;

    if (await isRateLimited(supabaseAdmin, { key: userKey, limit: 60, windowSeconds: 60 })) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (await isRateLimited(supabaseAdmin, { key: ipKey, limit: 300, windowSeconds: 60 })) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!AI_GATEWAY_API_KEY) {
      console.error("AI_GATEWAY_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "AI backend not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use service-role for data reads for RAG context
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build RAG context
    let ragContext = "";

    const { data: documents } = await supabaseService
      .from("teacher_documents")
      .select("file_name, content")
      .eq("teacher_id", teacherId)
      .not("content", "is", null)
      .limit(10);

    if (documents && documents.length > 0) {
      ragContext += `\n## Uploaded Documents\n`;
      for (const doc of documents) {
        ragContext += `### ${doc.file_name}\n`;
        const truncatedContent = (doc.content || "").substring(0, 2000);
        ragContext += `${truncatedContent}\n\n`;
      }
    }

    const { data: lessons } = await supabaseService
      .from("lessons")
      .select("title, subject, grade_level, description, objectives")
      .eq("teacher_id", teacherId)
      .limit(20);

    if (lessons && lessons.length > 0) {
      ragContext += `\n## Lesson Plans\n`;
      for (const lesson of lessons) {
        ragContext += `- ${lesson.title}`;
        if (lesson.subject) ragContext += ` (${lesson.subject})`;
        if (lesson.objectives) ragContext += ` - Objectives: ${String(lesson.objectives).substring(0, 100)}`;
        ragContext += `\n`;
      }
    }

    // Build prompt / call to AI provider (stream logic omitted for brevity — keep existing behavior)
    const systemPrompt = `You are Mentrix AI, a personalized teaching assistant for educators.\n\n${ragContext ? `## Teacher's Data Context\n${ragContext}` : ""}`;

    const response = await fetch("https://ai.gateway.mentrix.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("AI provider error", await response.text());
      return new Response(JSON.stringify({ error: "AI provider error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Stream response through (for simplicity return a success if you implement streaming).
    // If you need to implement streaming, pipe the response body to the caller.
    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "application/octet-stream" } });

  } catch (err) {
    console.error("ai-assistant error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
