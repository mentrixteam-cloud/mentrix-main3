// @ts-nocheck
// (Only the important sections are shown here; integrate into your existing function file where appropriate)
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  google_event_id: string | null;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token?: string; refresh_token?: string } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await response.json();
    if (tokens.access_token) {
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token, // may be undefined
      };
    }
    console.error("refreshAccessToken: invalid response", tokens);
    return null;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

// In the handler, after getting tokenData:
if (expiresAt < new Date()) {
  const refreshed = await refreshAccessToken(tokenData.refresh_token);
  if (!refreshed?.access_token) {
    return new Response(JSON.stringify({ error: "Failed to refresh tokens. Please reconnect Google Calendar." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const updatePayload: any = {
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (refreshed.refresh_token) {
    updatePayload.refresh_token = refreshed.refresh_token;
  }

  const { error: updateError } = await supabaseAdmin
    .from("google_calendar_tokens")
    .update(updatePayload)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to update google tokens after refresh", updateError);
  }

  accessToken = refreshed.access_token;
}
