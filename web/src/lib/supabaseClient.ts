import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type BrowserSupabaseClient = SupabaseClient;

function requirePublicEnv(
  value: string | undefined,
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string {
  if (value) {
    return value;
  }

  throw new Error(`Missing ${name}. Add it to your local env file or deployment environment variables.`);
}

let supabaseClient: BrowserSupabaseClient | null = null;

export function getSupabaseClient(): BrowserSupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = requirePublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    const supabaseKey = requirePublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
}

export const supabase = new Proxy({} as BrowserSupabaseClient, {
  get(_target, property) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, property);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});
