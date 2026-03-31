import { createClient } from '@supabase/supabase-js';

function readPublicEnv(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  throw new Error(`Missing ${name}. Add it to your local env file or deployment environment variables.`);
}

const supabaseUrl = readPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = readPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const supabase = createClient(supabaseUrl, supabaseKey);
