// Lecture des artefacts d'une leçon — Phase P8.  GET /api/lecons/[id]/artifacts
//
// Runtime élève : LECTURE du cache public (0 appel IA). Calcule la signature
// de version courante de la leçon puis renvoie les artefacts correspondants
// (jamais la partie secrète).

import { NextResponse } from 'next/server';
import { sbPublic } from '@/lib/supabase';
import { signatureContenu } from '@/lib/lesson-context';
import { getArtefactsCourants } from '@/lib/ai/artifacts-repo';
import type { Lecon } from '@/lib/types';

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await sbPublic()
    .from('lecons_public')
    .select('id, titre, contenu_mdx, essentiel_mdx, qcm, exercices, publie')
    .eq('id', id)
    .maybeSingle();
  const lecon = data as Partial<Lecon> | null;
  if (!lecon || !lecon.publie) {
    return NextResponse.json({ error: 'Leçon introuvable ou non publiée' }, { status: 404 });
  }

  const signature = signatureContenu([
    lecon.titre,
    lecon.contenu_mdx,
    lecon.essentiel_mdx,
    JSON.stringify(lecon.qcm ?? null),
    JSON.stringify(lecon.exercices ?? null),
  ]);

  const artefacts = await getArtefactsCourants(id, signature);
  return NextResponse.json({ lecon_id: id, lesson_version: signature, artefacts });
}
