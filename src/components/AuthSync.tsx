'use client';

// Synchronisation d'authentification — Phase P6.
// À la connexion (SIGNED_IN), fusionne une seule fois la progression locale
// dans le compte. Invisible et non bloquant : aucun impact pour les visiteurs
// anonymes (aucune session → aucune action).

import { useEffect, useRef } from 'react';
import { sbBrowser } from '@/lib/supabase-browser';
import { migrerProgressionLocale } from '@/lib/auth';

export default function AuthSync() {
  const dejaFusionne = useRef(false);

  useEffect(() => {
    const sb = sbBrowser();
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && !dejaFusionne.current) {
        dejaFusionne.current = true;
        migrerProgressionLocale(session.user.id).catch(() => {
          /* best-effort : ne jamais bloquer l'expérience */
        });
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
