import { createClient } from '@supabase/supabase-js';

function requirePublicEnv(
  value: string | undefined,
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string {
  if (value) {
    return value;
  }

  throw new Error(`Missing ${name}. Add it to your local env file or deployment environment variables.`);
}

const supabaseUrl = requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const supabaseKey = requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

export const supabase = createClient(supabaseUrl, supabaseKey);
