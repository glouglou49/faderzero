import { assertSupabaseConfig, supabase } from './client';
import type { Session, Subscription } from '@supabase/supabase-js';

export async function signInWithOtp(email: string) {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  assertSupabaseConfig();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  assertSupabaseConfig();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): Subscription {
  assertSupabaseConfig();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return subscription;
}

export async function verifyOtpToken(tokenHash: string, type: 'magiclink' | 'signup' = 'magiclink') {
  assertSupabaseConfig();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  if (error) throw error;
  return data;
}

