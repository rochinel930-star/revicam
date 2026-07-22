import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import { getClasses } from '@/lib/queries';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Cours & Fiches',
  description:
    'Cours structurés par classe et par matière, conformes aux programmes APC du MINESEC.',
};

/** Les classes du secondaire ; seules celles présentes en base sont actives. */
const TOUTES_CLASSES = [
  '6e', '5e', '4e', '3e', 'Seconde', 'Première A', 'Première C', 'Première D', 'Terminale',
];

export default async function PageCours() {
  const classes = await getClasses();
  const actives = new Map(classes.map((c) => [c.nom, c]));

  return (
    <div>
      <Breadcrumb miettes={[{ label: 'Cours & Fiches' }]} />
      <h1 className="mb-1 text-2xl font-bold text-navy">📘 Cours & Fiches</h1>
      <p className="mb-6 text-sm text-slate-600">
        Des cours complets, conformes à l’Approche Par Compétences du MINESEC, avec QCM
        corrigés instantanément et exercices type examen.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TOUTES_CLASSES.map((nom) => {
          const classe = actives.get(nom);
          if (classe) {
            return (
              <Link
                key={nom}
                href={`/cours/${classe.slug}`}
                className="rounded-lg border-2 border-navy bg-white p-4 text-center shadow-sm transition hover:bg-maths-bg"
              >
                <span className="block text-lg font-bold text-navy">{nom}</span>
                <span className="mt-1 block text-xs font-medium text-green-700">Disponible →</span>
              </Link>
            );
          }
          return (
            <div
              key={nom}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-slate-400"
            >
              <span className="block text-lg font-semibold">{nom}</span>
              <span className="mt-1 block text-xs">Bientôt</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
