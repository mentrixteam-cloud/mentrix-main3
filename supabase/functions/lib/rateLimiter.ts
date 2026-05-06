// @ts-nocheck
// Lightweight DB-backed rate limiter for Supabase Edge functions (Deno).
// Not perfectly atomic; for absolute atomicity consider a Postgres stored proc.
// Uses the public.rate_limits table to track counts per key.
/// <reference path="../deno-shim.d.ts" />
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RateLimitOptions = {
  key: string; // unique key (user:<id>, ip:<ip>, route:<name>)
  limit: number; // max requests in window
  windowSeconds: number;
};

/**
 * Returns true when the key is over the limit.
 * Requires a service-role client (server-side).
 */
export async function isRateLimited(supabaseAdmin: SupabaseClient, opts: RateLimitOptions): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(Date.now() + opts.windowSeconds * 1000).toISOString();

  // Try to select existing row
  const { data, error } = await supabaseAdmin
    .from("rate_limits")
    .select("*")
    .eq("key", opts.key)
    .single();

  // If error other than "not found", log and fail-open (allow)
  if (error && !(error && (error as any).code === "PGRST116")) {
    console.error("rateLimiter: select error", error);
    return false;
  }

  if (!data) {
    const { error: insertError } = await supabaseAdmin
      .from("rate_limits")
      .insert({
        key: opts.key,
        count: 1,
        reset_at: resetAt,
      });

    if (insertError) console.error("rateLimiter: insert error", insertError);
    return false;
  }

  const count = Number(data.count || 0);
  const resetAtDb = new Date(data.reset_at).getTime();
  const nowMs = Date.now();

  if (nowMs > resetAtDb) {
    const { error: upsertError } = await supabaseAdmin
      .from("rate_limits")
      .upsert({
        key: opts.key,
        count: 1,
        reset_at: resetAt,
      }, { onConflict: "key" });

    if (upsertError) console.error("rateLimiter: reset upsert error", upsertError);
    return false;
  }

  if (count >= opts.limit) {
    return true;
  }

  const { error: incError } = await supabaseAdmin
    .from("rate_limits")
    .update({ count: count + 1 })
    .eq("key", opts.key);

  if (incError) console.error("rateLimiter: increment error", incError);

  return false;
}