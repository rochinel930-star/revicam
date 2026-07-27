// Route d'ingestion — Phase P4.  POST /api/admin/ingest
//
// Fait passer un artefact dans le pipeline et le persiste EN STAGING (jamais
// en contenu de production). Jeton d'administration requis. Le résultat va en
// revue humaine (aRevoir = true). Aucune publication automatique.

import { NextResponse } from 'next/server';
import { verifierAdmin } from '@/lib/admin-auth';
import { sbAdmin } from '@/lib/supabase';
import { logger } from '@/lib/log';
import { ingerer } from '@/lib/ingestion';
import { persister, creerPersisteurSupabase } from '@/lib/ingestion/persist';
import { chargerReferentiel } from '@/lib/ingestion/referentiel';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const verdict = verifierAdmin(req);
  if (!verdict.ok) return NextResponse.json({ error: verdict.raison }, { status: verdict.statut });

  const log = logger();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const source = typeof body.source === 'string' ? body.source : '';
  const type = body.type;
  const mime = typeof body.mime === 'string' ? body.mime : '';
  const contenu = typeof body.contenu === 'string' ? body.contenu : null;
  if (!source || !mime || contenu === null || (type !== 'epreuve' && type !== 'lecon')) {
    return NextResponse.json(
      { error: 'Champs requis : source, type (epreuve|lecon), mime, contenu' },
      { status: 400 }
    );
  }

  const sb = sbAdmin();
  const referentiel = await chargerReferentiel(sb);
  const { data: notions } = await sb.from('notion').select('code, nom');

  const artefact = { source, type, mime, contenu } as const;
  const result = await ingerer(artefact, { referentiel, notionsConnues: notions ?? [] });
  const persistance = await persister(result, artefact, contenu, creerPersisteurSupabase(sb));

  log.info('ingestion', { hash: result.hash, ok: result.ok, doublon: persistance.doublon, score: result.score });

  return NextResponse.json(
    {
      hash: result.hash,
      ok: result.ok,
      score: result.score,
      etapeEchec: result.etapeEchec,
      problemes: result.problemes,
      suggestions: result.suggestions,
      aRevoir: result.aRevoir,
      jobId: persistance.jobId,
      doublon: persistance.doublon,
    },
    { status: result.ok ? 200 : 422, headers: { 'x-request-id': log.requestId } }
  );
}
