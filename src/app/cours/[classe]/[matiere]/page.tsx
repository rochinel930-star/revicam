import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import BadgeProgressLecon from '@/components/BadgeProgressLecon';
import {
  getClasse, getClasses, getMatiere, getMatieresDeClasse, getModules, getLeconsDesModules,
} from '@/lib/queries';

export const revalidate = 3600;

export async function generateStaticParams() {
  const classes = await getClasses();
  const params: { classe: string; matiere: string }[] = [];
  for (const c of classes) {
    const matieres = await getMatieresDeClasse(c.id);
    for (const m of matieres) params.push({ classe: c.slug, matiere: m.slug });
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ classe: string; matiere: string }> }) {
  const { classe, matiere } = await params;
  const [c, m] = await Promise.all([getClasse(classe), getMatiere(matiere)]);
  return { title: c && m ? `${m.nom} — ${c.nom}` : 'Matière' };
}

export default async function PageMatiere({
  params,
}: {
  params: Promise<{ classe: string; matiere: string }>;
}) {
  const { classe: classeSlug, matiere: matiereSlug } = await params;
  const [classe, matiere] = await Promise.all([getClasse(classeSlug), getMatiere(matiereSlug)]);
  if (!classe || !matiere) notFound();

  const modules = await getModules(classe.id, matiere.id);
  const lecons = await getLeconsDesModules(modules.map((m) => m.id));
  const parModule = new Map(modules.map((m) => [m.id, lecons.filter((l) => l.module_id === m.id)]));

  return (
    <div>
      <Breadcrumb
        miettes={[
          { href: '/cours', label: 'Cours & Fiches' },
          { href: `/cours/${classe.slug}`, label: classe.nom },
          { label: matiere.nom },
        ]}
      />
      <h1 className="mb-1 text-2xl font-bold" style={{ color: matiere.couleur_hex }}>
        {matiere.icone ? `${matiere.icone} ` : ''}{matiere.nom} — {classe.nom}
      </h1>

      {modules.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl">🚧</p>
          <p className="mt-2 font-medium text-slate-700">Programme en cours d’intégration</p>
          <p className="mt-1 text-sm text-slate-500">
            Les cours de {matiere.nom} arrivent bientôt. Reviens régulièrement !
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {modules.map((mo) => (
            <section key={mo.id}>
              <h2 className="mb-2 border-b-2 pb-1 text-base font-bold text-slate-800" style={{ borderColor: matiere.couleur_hex }}>
                Module {mo.numero} — {mo.titre}
              </h2>
              <ul className="space-y-1.5">
                {(parModule.get(mo.id) ?? []).map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/cours/${classe.slug}/${matiere.slug}/module-${mo.numero}/${l.slug}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition hover:border-navy"
                    >
                      <span>
                        <span className="mr-2 font-semibold text-slate-400">L{l.numero}</span>
                        <span className={l.publie ? 'font-medium text-slate-800' : 'text-slate-500'}>
                          {l.titre}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {l.publie ? <BadgeProgressLecon leconId={l.id} /> : (
                          <span className="text-xs text-slate-400">📝 bientôt</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
