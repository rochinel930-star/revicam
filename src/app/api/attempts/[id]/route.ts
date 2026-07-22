// PATCH /api/attempts/[id] — sauvegarde automatique des réponses (toutes les 10 s).
// GET   /api/attempts/[id] — résultat d'une tentative soumise.
// L'anon_id est exigé dans les deux cas : chacun n'accède qu'à ses tentatives.

import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase';
import { chargerAttempt, construireResultat } from '@/lib/attempts-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  let body: { anon_id?: string; reponses?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  if (!body.anon_id || !UUID_RE.test(body.anon_id) || !body.reponses) {
    return NextResponse.json({ error: 'anon_id et reponses requis' }, { status: 400 });
  }

  const sb = sbAdmin();
  const attempt = await chargerAttempt(sb, id, body.anon_id);
  if (!attempt) return NextResponse.json({ error: 'Tentative introuvable' }, { status: 404 });
  if (attempt.statut !== 'en_cours') {
    return NextResponse.json({ error: 'Tentative déjà soumise' }, { status: 409 });
  }

  // Ne garder que les questions appartenant bien à cette composition.
  const { data: questions } = await sb
    .from('questions')
    .select('id')
    .eq('composition_id', attempt.composition_id);
  const valides = new Set((questions ?? []).map((q) => q.id));

  const rows = Object.entries(body.reponses)
    .filter(([qid]) => valides.has(qid))
    .map(([qid, reponse]) => ({ attempt_id: id, question_id: qid, reponse }));
  if (rows.length > 0) {
    const { error } = await sb
      .from('attempt_answers')
      .upsert(rows, { onConflict: 'attempt_id,question_id' });
    if (error) return NextResponse.json({ error: 'Sauvegarde impossible' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sauvegardees: rows.length });
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const anonId = new URL(req.url).searchParams.get('anon_id');
  if (!anonId || !UUID_RE.test(anonId)) {
    return NextResponse.json({ error: 'anon_id requis' }, { status: 400 });
  }
  const sb = sbAdmin();
  const attempt = await chargerAttempt(sb, id, anonId);
  if (!attempt) return NextResponse.json({ error: 'Tentative introuvable' }, { status: 404 });
  if (attempt.statut === 'en_cours') {
    // Jamais de corrigés avant soumission.
    return NextResponse.json({ attempt: { id: attempt.id, statut: attempt.statut } });
  }
  return NextResponse.json(await construireResultat(sb, attempt));
}
