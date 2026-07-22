// Clients Supabase côté serveur.
//
// - sbPublic()  : clé anon, lecture publique (SSG/ISR/SSR). Ne voit JAMAIS
//                 les bonnes réponses ni les corrigés (RLS + vue questions_public).
// - sbAdmin()   : clé service_role, réservé aux routes API serveur
//                 (tentatives, correction). NE JAMAIS importer dans un
//                 composant client.

import { createClient } from '@supabase/supabase-js';

// URL et clé anon du projet : valeurs PUBLIQUES par nature (la clé anon est
// livrée à chaque navigateur et protégée par la RLS). Les variables d'env,
// quand elles sont définies, ont la priorité — ces valeurs de repli garantissent
// simplement que le build fonctionne partout. Les clés SECRÈTES (service_role,
// Anthropic) ne sont jamais ici : voir sbAdmin() et lib/grading.ts.
const URL_PUBLIQUE = 'https://xjzthitjhplgrsfdaial.supabase.co';
const ANON_PUBLIQUE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqenRoaXRqaHBsZ3JzZmRhaWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2ODc5NjYsImV4cCI6MjEwMDI2Mzk2Nn0.svEUmQB2DNWa2K5TVt-7BYsFq8jz6hHuwnPQ5hek0VY';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? URL_PUBLIQUE;

export function sbPublic() {
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ANON_PUBLIQUE, {
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
