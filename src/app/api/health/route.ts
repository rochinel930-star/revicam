// Endpoint de santé — Phase P1 (observabilité).
//
//   GET /api/health
//
// Vérifie les dépendances critiques sans jamais exposer de secret :
//   - base de données : lecture d'un enregistrement via la vue publique
//     (valide la connectivité Supabase ET le contrat RLS/vue) ;
//   - adaptateur LLM  : présence de la clé (contrôle de configuration,
//     AUCUN appel réseau, aucune facturation).
//
// Réponse : 200 si tout est « up », 503 si une dépendance critique est
// « down ». Le détail des checks est modulé par le flag pilote
// `health_verbose`. Corrélation par `x-request-id`.

import { NextResponse } from 'next/server';
import { sbPublic } from '@/lib/supabase';
import { logger } from '@/lib/log';
import { getFlag } from '@/lib/flags';

export const dynamic = 'force-dynamic';

type EtatCheck = 'up' | 'down';
interface Check {
  nom: string;
  etat: EtatCheck;
  critique: boolean;
  detail?: string;
}

async function checkBase(): Promise<Check> {
  try {
    const { error } = await sbPublic().from('lecons_public').select('id').limit(1);
    if (error) return { nom: 'database', etat: 'down', critique: true, detail: error.message };
    return { nom: 'database', etat: 'up', critique: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'erreur inconnue';
    return { nom: 'database', etat: 'down', critique: true, detail };
  }
}

function checkLlm(): Check {
  // Contrôle de configuration uniquement — on ne contacte pas l'API.
  // 100 % Gemini : génération (P8) et correction (grading) via GEMINI_API_KEY.
  const configure = Boolean(process.env.GEMINI_API_KEY);
  return {
    nom: 'llm_adapter',
    etat: configure ? 'up' : 'down',
    critique: false, // l'IA est optionnelle : non bloquant.
    detail: configure ? 'gemini' : 'GEMINI_API_KEY absente',
  };
}

export async function GET() {
  const log = logger();
  const verbose = getFlag('health_verbose');

  const checks: Check[] = [await checkBase(), checkLlm()];
  const enPanneCritique = checks.some((c) => c.critique && c.etat === 'down');
  const status = enPanneCritique ? 'down' : 'up';

  if (enPanneCritique) {
    log.error('health check en échec', { checks });
  } else {
    log.info('health check OK', { verbose });
  }

  const corps = {
    status,
    request_id: log.requestId,
    timestamp: new Date().toISOString(),
    ...(verbose
      ? { checks }
      : { checks: checks.map((c) => ({ nom: c.nom, etat: c.etat })) }),
  };

  return NextResponse.json(corps, {
    status: enPanneCritique ? 503 : 200,
    headers: {
      'x-request-id': log.requestId,
      'cache-control': 'no-store',
    },
  });
}
