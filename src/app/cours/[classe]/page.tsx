import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import ProgressionMatiere from '@/components/ProgressionMatiere';
import { getClasse, getClasses, getMatieresDeClasse, getModules, getLeconsDesModules } from '@/lib/queries';

export const revalidate = 3600;

export async function generateStaticParams() {
  const classes = await getClasses();
  return classes.map((c) => ({ classe: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ classe: string }> }) {
  const { classe } = await params;
  const c = await getClasse(classe);
  return { title: c ? `Cours ${c.nom}` : 'Classe' };
}

export default async function PageClasse({ params }: { params: Promise<{ classe: string }> }) {
  const { classe: classeSlug } = await params;
  const classe = await getClasse(classeSlug);
  if (!classe) notFound();

  const matieres = await getMatieresDeClasse(classe.id);
  // Pour chaque matière : modules + leçons publiées (pour la progression).
  const cartes = await Promise.all(
    matieres.map(async (m) => {
      const modules = await getModules(classe.id, m.id);
      const lecons = await getLeconsDesModules(modules.map((mo) => mo.id));
      return { matiere: m, nbModules: modules.length, lecons };
    })
  );

  return (
    <div>
      <Breadcrumb miettes={[{ href: '/cours', label: 'Cours & Fiches' }, { label: classe.nom }]} />
      <h1 className="mb-1 text-2xl font-bold text-navy">{classe.nom}</h1>
      <p className="mb-6 text-sm text-slate-600">
        Choisis ta matière. Objectif Probatoire : <strong>au moins 10/20 dans chaque matière</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cartes.map(({ matiere, nbModules, lecons }) => {
          const publiees = lecons.filter((l) => l.publie);
          const contenu = nbModules > 0;
          return (
            <Link
              key={matiere.id}
              href={`/cours/${classe.slug}/${matiere.slug}`}
              className="rounded-lg border-l-4 bg-white p-4 shadow-sm transition hover:shadow"
              style={{ borderLeftColor: matiere.couleur_hex }}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold" style={{ color: matiere.couleur_hex }}>
                  {matiere.icone ? `${matiere.icone} ` : ''}{matiere.nom}
                </span>
                <span className="text-xs text-slate-500">
                  {contenu ? `${lecons.length} leçons · ${publiees.length} en ligne` : 'Programme en cours d’intégration'}
                </span>
              </div>
              {contenu && (
                <ProgressionMatiere
                  leconIds={publiees.map((l) => l.id)}
                  couleur={matiere.couleur_hex}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
