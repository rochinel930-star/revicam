'use client';

// Client Supabase côté NAVIGATEUR — Phase P6 (auth).
//
// Distinct de sbPublic()/sbAdmin() (serveur). Ici la session est PERSISTÉE
// (localStorage) et rafraîchie automatiquement : c'est le client des flux
// d'authentification et des écritures « owned » (progression liée au compte).
// Clé anon uniquement — jamais de secret. Singleton (un seul client par onglet).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_PUBLIQUE = 'https://xjzthitjhplgrsfdaial.supabase.co';
const ANON_PUBLIQUE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqenRoaXRqaHBsZ3JzZmRhaWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2ODc5NjYsImV4cCI6MjEwMDI2Mzk2Nn0.svEUmQB2DNWa2K5TVt-7BYsFq8jz6hHuwnPQ5hek0VY';

let client: SupabaseClient | null = null;

export function sbBrowser(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? URL_PUBLIQUE;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ANON_PUBLIQUE;
  client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
