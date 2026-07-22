// Clients Supabase côté serveur.
//
// - sbPublic()  : clé anon, lecture publique (SSG/ISR/SSR). Ne voit JAMAIS
//                 les bonnes réponses ni les corrigés (RLS + vue questions_public).
// - sbAdmin()   : clé service_role, réservé aux routes API serveur
//                 (tentatives, correction). NE JAMAIS importer dans un
//                 composant client.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function sbPublic() {
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

export function sbAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquante — la renseigner dans .env.local (et dans les variables Vercel).'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
