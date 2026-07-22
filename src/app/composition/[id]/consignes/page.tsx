import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import BoutonCommencer from '@/components/BoutonCommencer';
import { getComposition, getQuestionsPubliques } from '@/lib/queries';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getComposition(id);
  return { title: c ? `Consignes — ${c.titre}` : 'Composition' };
}

export default async function PageConsignes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const composition = await getComposition(id);
  if (!composition || !composition.publie) notFound();
  const questions = await getQuestionsPubliques(id);
  const nbQcm = questions.filter((q) => q.type === 'qcm').length;
  const nbLibres = questions.length - nbQcm;

  return (
    <div className="mx-auto max-w-lg">
      <Breadcrumb
        miettes={[{ href: '/composition', label: 'Salle de Composition' }, { label: 'Consignes' }]}
      />
      <div className="rounded-lg border-t-4 bg-white p-5 shadow-sm" style={{ borderTopColor: composition.matieres?.couleur_hex ?? '#1A237E' }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {composition.matieres?.nom} · {composition.classes?.nom}
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{composition.titre}</h1>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-[0.7rem] text-slate-500">Durée officielle</dt>
            <dd className="text-lg font-bold text-navy">{composition.duree_minutes} min</dd>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-[0.7rem] text-slate-500">Questions</dt>
            <dd className="text-lg font-bold text-navy">{questions.length}</dd>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-[0.7rem] text-slate-500">Barème</dt>
            <dd className="text-lg font-bold text-navy">/{Number(composition.bareme_total)}</dd>
          </div>
        </dl>

        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          <li>📋 {nbQcm} QCM (correction automatique) et {nbLibres} question{nbLibres > 1 ? 's' : ''} rédigée{nbLibres > 1 ? 's' : ''} (corrigée{nbLibres > 1 ? 's' : ''} par IA).</li>
          <li>⏱ Le chrono démarre dès que tu cliques — comme en salle d’examen.</li>
          <li>💾 Tes réponses sont sauvegardées automatiquement : une coupure de connexion ou de courant ne fait rien perdre.</li>
          <li>🎯 Rappel Probatoire : il faut <strong>au moins 10/20 dans chaque matière</strong>.</li>
        </ul>

        <div className="mt-5">
          <BoutonCommencer compositionId={composition.id} />
        </div>
      </div>
    </div>
  );
}
