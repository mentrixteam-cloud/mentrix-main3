// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRateLimited } from "../lib/rateLimiter.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userKey = `google-calendar-auth:user:${user.id}`;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const ipKey = `google-calendar-auth:ip:${ip}`;

    if (await isRateLimited(supabaseAdmin, { key: userKey, limit: 10, windowSeconds: 60 })) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (await isRateLimited(supabaseAdmin, { key: ipKey, limit: 50, windowSeconds: 60 })) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, code } = await req.json().catch(() => ({}));

    if (action === "exchange_code") {
      if (!code) {
        return new Response(JSON.stringify({ error: "No code provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Token exchange error:", tokens);
        return new Response(JSON.stringify({ error: "Failed to exchange code" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const expiresIn = tokens.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const upsertPayload: any = {
        user_id: user.id,
        access_token: tokens.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      };

      if (tokens.refresh_token) {
        upsertPayload.refresh_token = tokens.refresh_token;
      }

      const { error: upsertError } = await supabaseAdmin
        .from("google_calendar_tokens")
        .upsert(upsertPayload, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Error storing tokens:", upsertError);
        return new Response(JSON.stringify({ error: "Failed to store tokens" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check_status") {
      const { data: tokenData } = await supabaseAdmin
        .from("google_calendar_tokens")
        .select("user_id, expires_at")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({
        connected: !!tokenData,
        expiresAt: tokenData?.expires_at
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      const { error: deleteError } = await supabaseAdmin
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error disconnecting tokens:", deleteError);
        return new Response(JSON.stringify({ error: "Failed to disconnect" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("google-calendar-auth error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
