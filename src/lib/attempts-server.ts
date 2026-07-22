// Logique serveur partagée des tentatives (lecture résultat + diagnostic).
// SERVEUR UNIQUEMENT : lit bonnes_reponses / corrige_type_mdx via service_role,
// et ne les renvoie qu'APRÈS soumission.

import { SupabaseClient } from '@supabase/supabase-js';
import { mdToHtml } from './markdown';
import type { Reponse, FeedbackIA } from './types';

export interface QuestionResultat {
  id: string;
  ordre: number;
  type: 'qcm' | 'libre';
  enonce_html: string;
  options: { id: string; texte: string }[] | null;
  bareme: number;
  lecon_id: string | null;
  bonnes_reponses: string[] | null;
  corrige_html: string | null;
  reponse: Reponse | null;
  note: number | null;
  feedback_ia: FeedbackIA | null;
}

export interface DiagnosticLecon {
  lecon_id: string;
  titre: string;
  numero: number;
  url: string;
  points: number;
  bareme: number;
}

export interface ResultatPayload {
  attempt: {
    id: string;
    statut: string;
    note_finale: number | null;
    submitted_at: string | null;
  };
  composition: {
    id: string;
    titre: string;
    bareme_total: number;
    duree_minutes: number;
  };
  questions: QuestionResultat[];
  diagnostic: DiagnosticLecon[];
}

/** Charge une tentative et vérifie qu'elle appartient bien à cet anon_id. */
export async function chargerAttempt(sb: SupabaseClient, attemptId: string, anonId: string) {
  const { data: attempt } = await sb
    .from('attempts')
    .select('*, compositions(id, titre, bareme_total, duree_minutes, classe_id, matiere_id)')
    .eq('id', attemptId)
    .maybeSingle();
  if (!attempt) return null;
  if (attempt.anon_id !== anonId) return null;
  return attempt;
}

/** Construit le payload de résultat d'une tentative SOUMISE (corrigés révélés). */
export async function construireResultat(
  sb: SupabaseClient,
  attempt: {
    id: string;
    statut: string;
    note_finale: number | null;
    submitted_at: string | null;
    composition_id: string;
    compositions: { id: string; titre: string; bareme_total: number; duree_minutes: number };
  }
): Promise<ResultatPayload> {
  const [{ data: questions }, { data: answers }] = await Promise.all([
    sb.from('questions').select('*').eq('composition_id', attempt.composition_id).order('ordre'),
    sb.from('attempt_answers').select('*').eq('attempt_id', attempt.id),
  ]);
  const parQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));

  const qs: QuestionResultat[] = (questions ?? []).map((q) => {
    const a = parQuestion.get(q.id);
    return {
      id: q.id,
      ordre: q.ordre,
      type: q.type,
      enonce_html: mdToHtml(q.enonce_mdx),
      options: q.options,
      bareme: Number(q.bareme),
      lecon_id: q.lecon_id,
      bonnes_reponses: q.bonnes_reponses,
      corrige_html: q.corrige_type_mdx ? mdToHtml(q.corrige_type_mdx) : null,
      reponse: a?.reponse ?? null,
      note: a?.note !== null && a?.note !== undefined ? Number(a.note) : null,
      feedback_ia: a?.feedback_ia ?? null,
    };
  });

  // ── Diagnostic par leçon : points obtenus / barème par leçon ──────
  const parLecon = new Map<string, { points: number; bareme: number }>();
  for (const q of qs) {
    if (!q.lecon_id) continue;
    const cur = parLecon.get(q.lecon_id) ?? { points: 0, bareme: 0 };
    cur.bareme += q.bareme;
    cur.points += q.note ?? 0;
    parLecon.set(q.lecon_id, cur);
  }

  const diagnostic: DiagnosticLecon[] = [];
  if (parLecon.size > 0) {
    const { data: lecons } = await sb
      .from('lecons')
      .select('id, numero, titre, slug, module_id, modules(numero, classe_id, matiere_id, classes(slug), matieres(slug))')
      .in('id', [...parLecon.keys()]);
    for (const l of lecons ?? []) {
      const stats = parLecon.get(l.id)!;
      const mod = l.modules as unknown as {
        numero: number;
        classes: { slug: string } | null;
        matieres: { slug: string } | null;
      } | null;
      const url = mod?.classes && mod?.matieres
        ? `/cours/${mod.classes.slug}/${mod.matieres.slug}/module-${mod.numero}/${l.slug}`
        : '/cours';
      diagnostic.push({
        lecon_id: l.id,
        titre: l.titre,
        numero: l.numero,
        url,
        points: stats.points,
        bareme: stats.bareme,
      });
    }
    diagnostic.sort((a, b) => a.points / a.bareme - b.points / b.bareme);
  }

  return {
    attempt: {
      id: attempt.id,
      statut: attempt.statut,
      note_finale: attempt.note_finale !== null ? Number(attempt.note_finale) : null,
      submitted_at: attempt.submitted_at,
    },
    composition: {
      id: attempt.compositions.id,
      titre: attempt.compositions.titre,
      bareme_total: Number(attempt.compositions.bareme_total),
      duree_minutes: attempt.compositions.duree_minutes,
    },
    questions: qs,
    diagnostic,
  };
}
