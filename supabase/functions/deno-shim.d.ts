declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export interface SupabaseQueryBuilder<T = any> extends PromiseLike<{ data: T | null; error: any }> {
    select(columns?: string): SupabaseQueryBuilder<T>;
    eq(column: string, value: unknown): SupabaseQueryBuilder<T>;
    single(): Promise<{ data: any; error: any }>;
    insert(values: unknown): Promise<{ data: any; error: any }>;
    upsert(values: unknown, options?: { onConflict?: string }): Promise<{ data: any; error: any }>;
    update(values: unknown): SupabaseQueryBuilder<T>;
  }

  export interface SupabaseClient {
    from(table: string): SupabaseQueryBuilder;
  }
}
