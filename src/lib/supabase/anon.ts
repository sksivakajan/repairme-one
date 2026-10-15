import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
// Session-less client for the desktop agent endpoints. The database functions authenticate the agent by its private token.
export function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
