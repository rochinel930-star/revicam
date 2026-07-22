import { notFound } from 'next/navigation';
import SessionClient from '@/components/SessionClient';
import { getComposition, getQuestionsPubliques } from '@/lib/queries';
import { mdToHtml } from '@/lib/markdown';

// Page dynamique : les énoncés sont rendus en HTML côté serveur, via la vue
// publique questions_public — les corrigés ne transitent jamais ici.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getComposition(id);
  return { title: c ? `Composition — ${c.titre}` : 'Composition' };
}

export default async function PageSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const composition = await getComposition(id);
  if (!composition || !composition.publie) notFound();
  const questions = await getQuestionsPubliques(id);

  return (
    <SessionClient
      composition={{
        id: composition.id,
        titre: composition.titre,
        duree_minutes: composition.duree_minutes,
        mode_affichage: composition.mode_affichage,
        bareme_total: Number(composition.bareme_total),
      }}
      questions={questions.map((q) => ({
        id: q.id,
        ordre: q.ordre,
        type: q.type,
        enonceHtml: mdToHtml(q.enonce_mdx),
        options: q.options,
        bareme: Number(q.bareme),
      }))}
    />
  );
}
