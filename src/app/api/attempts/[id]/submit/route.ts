// POST /api/attempts/[id]/submit — remise de copie.
// Correction hybride :
//   1. QCM corrigés par règle, côté serveur (bonnes_reponses jamais envoyées
//      au client avant ce moment).
//   2. Questions libres corrigées par IA (Claude) avec le corrigé type.
// Repli gracieux : si la correction IA échoue, les QCM restent notés et la
// tentative passe en statut correction_partielle — re-soumettre relance la
// correction des libres manquantes.

import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase';
import { chargerAttempt, construireResultat } from '@/lib/attempts-server';
import { corrigerReponseLibre } from '@/lib/grading';
import type { Reponse } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function memesEnsembles(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { anon_id?: string; reponses?: Record<string, Reponse> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  if (!body.anon_id || !UUID_RE.test(body.anon_id)) {
    return NextResponse.json({ error: 'anon_id requis' }, { status: 400 });
  }

  const sb = sbAdmin();
  const attempt = await chargerAttempt(sb, id, body.anon_id);
  if (!attempt) return NextResponse.json({ error: 'Tentative introuvable' }, { status: 404 });
  if (attempt.statut === 'corrigee') {
    // Déjà corrigée : renvoyer le résultat existant (idempotent).
    return NextResponse.json(await construireResultat(sb, attempt));
  }

  const { data: questions } = await sb
    .from('questions')
    .select('*')
    .eq('composition_id', attempt.composition_id)
    .order('ordre');
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'Composition sans questions' }, { status: 500 });
  }

  // ── 1. Enregistrer les dernières réponses reçues ──────────────────
  if (body.reponses && attempt.statut === 'en_cours') {
    const valides = new Set(questions.map((q) => q.id));
    const rows = Object.entries(body.reponses)
      .filter(([qid]) => valides.has(qid))
      .map(([qid, reponse]) => ({ attempt_id: id, question_id: qid, reponse }));
    if (rows.length > 0) {
      await sb.from('attempt_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
    }
  }
  await sb
    .from('attempts')
    .update({ statut: 'soumise', submitted_at: attempt.submitted_at ?? new Date().toISOString() })
    .eq('id', id);

  const { data: answers } = await sb.from('attempt_answers').select('*').eq('attempt_id', id);
  const parQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));

  // ── 2. Correction ─────────────────────────────────────────────────
  let iaIncomplet = false;
  const maintenant = new Date().toISOString();

  // QCM : règle stricte, en une passe.
  for (const q of questions.filter((q) => q.type === 'qcm')) {
    const a = parQuestion.get(q.id);
    if (a && a.note !== null && a.corrigee_at) continue; // déjà notée
    const reponse = (a?.reponse ?? null) as Reponse | null;
    const choix = reponse && 'choix' in reponse ? reponse.choix : [];
    const bonnes: string[] = q.bonnes_reponses ?? [];
    const note = memesEnsembles(choix, bonnes) ? Number(q.bareme) : 0;
    await sb.from('attempt_answers').upsert(
      { attempt_id: id, question_id: q.id, reponse, note, corrigee_at: maintenant },
      { onConflict: 'attempt_id,question_id' }
    );
  }

  // Libres : correction IA en parallèle (peu de questions par épreuve).
  const libres = questions.filter((q) => q.type === 'libre');
  await Promise.all(
    libres.map(async (q) => {
      const a = parQuestion.get(q.id);
      if (a && a.note !== null && a.corrigee_at) return; // déjà corrigée (re-soumission)
      const reponse = (a?.reponse ?? null) as Reponse | null;
      const texte = reponse && 'texte' in reponse ? reponse.texte : '';
      const resultat = await corrigerReponseLibre(
        q.enonce_mdx,
        q.corrige_type_mdx ?? '',
        Number(q.bareme),
        texte
      );
      if (resultat === null) {
        iaIncomplet = true;
        await sb.from('attempt_answers').upsert(
          { attempt_id: id, question_id: q.id, reponse, note: null, feedback_ia: null },
          { onConflict: 'attempt_id,question_id' }
        );
        return;
      }
      await sb.from('attempt_answers').upsert(
        {
          attempt_id: id,
          question_id: q.id,
          reponse,
          note: resultat.note,
          feedback_ia: {
            appreciation: resultat.appreciation,
            points_forts: resultat.points_forts,
            points_a_corriger: resultat.points_a_corriger,
          },
          corrigee_at: new Date().toISOString(),
        },
        { onConflict: 'attempt_id,question_id' }
      );
    })
  );

  // ── 3. Note finale et statut ──────────────────────────────────────
  const { data: corrigees } = await sb.from('attempt_answers').select('note').eq('attempt_id', id);
  const noteFinale = iaIncomplet
    ? null
    : (corrigees ?? []).reduce((s, a) => s + (a.note !== null ? Number(a.note) : 0), 0);
  const statut = iaIncomplet ? 'correction_partielle' : 'corrigee';
  await sb.from('attempts').update({ statut, note_finale: noteFinale }).eq('id', id);

  const attemptMaj = { ...attempt, statut, note_finale: noteFinale, submitted_at: attempt.submitted_at ?? maintenant };
  return NextResponse.json(await construireResultat(sb, attemptMaj));
}
