// Route de promotion — Phase P4.  POST /api/admin/promote
//
// Promeut une extraction en staging vers un BROUILLON de contenu (publie=false)
// après APPROBATION HUMAINE explicite (approuve:true) et RE-VALIDATION du gate.
// Jamais de publication automatique ; les corrigés ne sont jamais fixés par
// l'IA seule (ils proviennent de l'extraction validée puis revue).

import { NextResponse } from 'next/server';
import { verifierAdmin } from '@/lib/admin-auth';
import { sbAdmin } from '@/lib/supabase';
import { logger } from '@/lib/log';
import { valider } from '@/lib/ingestion/validate';
import { extractionVersBrouillon } from '@/lib/ingestion/promote';
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

  const jobId = typeof body.job_id === 'string' ? body.job_id : '';
  if (!jobId) return NextResponse.json({ error: 'job_id requis' }, { status: 400 });
  if (body.approuve !== true) {
    return NextResponse.json({ error: 'Approbation humaine requise (approuve: true)' }, { status: 400 });
  }

  const sb = sbAdmin();
  const { data: job } = await sb
    .from('ingestion_job')
    .select('content_hash, type')
    .eq('id', jobId)
    .maybeSingle();
  const { data: ext } = await sb
    .from('ingestion_extraction')
    .select('payload')
    .eq('job_id', jobId)
    .maybeSingle();
  if (!job || !ext) return NextResponse.json({ error: 'Job ou extraction introuvable' }, { status: 404 });

  // Re-validation déterministe (gate) avant toute écriture.
  const referentiel = await chargerReferentiel(sb);
  const validation = valider(ext.payload, referentiel);
  if (!validation.ok || !validation.extraction) {
    return NextResponse.json({ error: 'Revalidation échouée', problemes: validation.problemes }, { status: 422 });
  }

  const brouillon = extractionVersBrouillon(validation.extraction, job.content_hash as string);
  const [{ data: classe }, { data: matiere }] = await Promise.all([
    sb.from('classes').select('id').eq('slug', brouillon.composition.classe).maybeSingle(),
    sb.from('matieres').select('id').eq('slug', brouillon.composition.matiere).maybeSingle(),
  ]);
  if (!classe || !matiere) {
    return NextResponse.json({ error: 'Classe ou matière introuvable' }, { status: 422 });
  }

  const { data: comp, error: eComp } = await sb
    .from('compositions')
    .upsert(
      {
        slug: brouillon.composition.slug,
        titre: brouillon.composition.titre,
        matiere_id: matiere.id,
        classe_id: classe.id,
        duree_minutes: brouillon.composition.duree_minutes,
        bareme_total: brouillon.composition.bareme_total,
        mode_affichage: brouillon.composition.mode_affichage,
        publie: false, // JAMAIS publié automatiquement.
      },
      { onConflict: 'slug' }
    )
    .select('id')
    .single();
  if (eComp || !comp) {
    return NextResponse.json({ error: `Écriture composition : ${eComp?.message}` }, { status: 500 });
  }

  const qRows = brouillon.questions.map((q) => ({ composition_id: comp.id, ...q }));
  const { error: eQ } = await sb.from('questions').upsert(qRows, { onConflict: 'composition_id,ordre' });
  if (eQ) return NextResponse.json({ error: `Écriture questions : ${eQ.message}` }, { status: 500 });

  await sb.from('ingestion_job').update({ statut: 'promu' }).eq('id', jobId);
  await sb
    .from('ingestion_review')
    .update({ statut: 'accepte', decided_at: new Date().toISOString() })
    .eq('job_id', jobId);

  log.info('promotion', { jobId, compositionId: comp.id });
  return NextResponse.json(
    { ok: true, composition_id: comp.id, publie: false, questions: qRows.length },
    { headers: { 'x-request-id': log.requestId } }
  );
}
