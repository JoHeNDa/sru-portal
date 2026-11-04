'use client';
import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

declare global {
  interface GoogleAccountsId { initialize: (config: Record<string, unknown>) => void; prompt: () => void }
  interface Window { google?: { accounts: { id: GoogleAccountsId } }; __sruOneTap?: boolean }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// One-time value that ties the Google sign-in to this browser (Supabase checks it).
async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Loads Google's script once, even if this component mounts several times.
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    let el = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (!el) {
      el = document.createElement('script');
      el.src = GSI_SRC;
      el.async = true;
      document.head.appendChild(el);
    }
    el.addEventListener('load', () => resolve(), { once: true });
    el.addEventListener('error', () => reject(new Error('Could not load Google sign-in')), { once: true });
  });
}

// One-click sign-in for returning visitors. After sign-in the app looks the email up:
// a row in `members` means registered, a row in `staff_roles` means staff, neither means
// the topbar shows "Become a Member".
export default function GoogleOneTap() {
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || window.__sruOneTap) return;
    window.__sruOneTap = true;

    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;

      await loadGoogleScript();

      const rawNonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
      const hashedNonce = await sha256Hex(rawNonce);

      window.google!.accounts.id.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
        auto_select: true,
        cancel_on_tap_outside: false,
        callback: async ({ credential }: { credential: string }) => {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: rawNonce });
          if (error) { console.error('Sign-in failed:', error.message); return; }
          location.reload();
        },
      });
      window.google!.accounts.id.prompt();
    })().catch(err => {
      console.error(err);
      window.__sruOneTap = false;
    });
  }, []);

  return null;
}
