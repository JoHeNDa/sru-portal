import { createBrowserClient } from '@supabase/ssr';

// Supabase client for pages that run in the member's browser. Access is limited by the database rules (RLS).
export const browser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
