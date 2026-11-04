import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase';

// Where Google sends the visitor back after the "Continue with Google" button.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get('code');
  const next = u.searchParams.get('next') ?? '/';
  if (code) await (await userClient()).auth.exchangeCodeForSession(code);
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(new URL(safe, u.origin));
}
