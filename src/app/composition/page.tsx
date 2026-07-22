import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import { getCompositions } from '@/lib/queries';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Salle de Composition',
  description:
    'Compose en ligne comme en salle d’examen : chrono officiel, correction automatique et note immédiate sur 20.',
};

export default async function PageCompositions() {
  const compositions = await getCompositions();
  // Regrouper par matière
  const parMatiere = new Map<string, typeof compositions>();
  for (const c of compositions) {
    const nom = c.matieres?.nom ?? 'Autre';
    if (!parMatiere.has(nom)) parMatiere.set(nom, []);
    parMatiere.get(nom)!.push(c);
  }

  return (
    <div>
      <Breadcrumb miettes={[{ label: 'Salle de Composition' }]} />
      <h1 className="mb-1 text-2xl font-bold text-navy">✍️ Salle de Composition</h1>
      <p className="mb-6 text-sm text-slate-600">
        Compose comme le jour de l’examen : chrono, copie, remise… et ta note sur 20
        immédiatement, avec le diagnostic des leçons à réviser.
      </p>

      {compositions.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
          Aucune composition disponible pour le moment.
        </p>
      ) : (
        [...parMatiere.entries()].map(([nomMatiere, liste]) => (
          <section key={nomMatiere} className="mb-6">
            <h2
              className="mb-2 border-b-2 pb-1 text-base font-bold"
              style={{ borderColor: liste[0].matieres?.couleur_hex ?? '#64748B', color: liste[0].matieres?.couleur_hex ?? '#334155' }}
            >
              {nomMatiere}
            </h2>
            <ul className="space-y-2">
              {liste.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/composition/${c.id}/consignes`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-navy"
                  >
                    <span>
                      <span className="block font-medium text-slate-800">{c.titre}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {c.classes?.nom} · ⏱ {c.duree_minutes} min · /{Number(c.bareme_total)}
                      </span>
                    </span>
                    <span className="rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white">
                      Composer →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
