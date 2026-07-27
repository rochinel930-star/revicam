// Notation premium d'une réponse ouverte — Phase P8.
//   POST /api/lecons/[id]/grade   body: { signature, index, reponse }
//
// SERVEUR UNIQUEMENT. Charge la rubrique SECRÈTE (service_role), corrige via le
// modèle premium (grading.ts), et ne renvoie JAMAIS le corrigé — seulement la
// note et le feedback. Coût premium, uniquement à la soumission.

import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase';
import { corrigerReponseLibre } from '@/lib/grading';
import { logger } from '@/lib/log';
import type { QuestionOuverte, RubriqueOuverte } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = logger();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const signature = typeof body.signature === 'string' ? body.signature : '';
  const index = typeof body.index === 'number' ? body.index : -1;
  const reponse = typeof body.reponse === 'string' ? body.reponse : '';
  if (!signature || index < 0) {
    return NextResponse.json({ error: 'Champs requis : signature, index, reponse' }, { status: 400 });
  }

  let sb;
  try {
    sb = sbAdmin();
  } catch {
    return NextResponse.json({ error: 'Notation indisponible (service non configuré)' }, { status: 503 });
  }

  const { data } = await sb
    .from('lesson_artifact')
    .select('payload, secret')
    .eq('lecon_id', id)
    .eq('type', 'questions_ouvertes')
    .eq('signature', signature)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Questions ouvertes introuvables' }, { status: 404 });

  const questions = (data.payload as QuestionOuverte[]) ?? [];
  const rubriques = (data.secret as RubriqueOuverte[]) ?? [];
  const question = questions[index];
  const rubrique = rubriques[index];
  if (!question || !rubrique) {
    return NextResponse.json({ error: 'Index de question invalide' }, { status: 400 });
  }

  const note = await corrigerReponseLibre(
    question.question_mdx,
    rubrique.corrige_type_mdx,
    rubrique.bareme,
    reponse
  );
  if (!note) {
    // Repli gracieux : correction indisponible (clé absente / erreur).
    return NextResponse.json(
      { indisponible: true, bareme: rubrique.bareme, message: 'Correction automatique momentanément indisponible.' },
      { status: 200, headers: { 'x-request-id': log.requestId } }
    );
  }

  log.info('grade_ouverte', { lecon: id, index, note: note.note });
  return NextResponse.json(
    {
      note: note.note,
      bareme: rubrique.bareme,
      appreciation: note.appreciation,
      points_forts: note.points_forts,
      points_a_corriger: note.points_a_corriger,
    },
    { headers: { 'x-request-id': log.requestId } }
  );
}
