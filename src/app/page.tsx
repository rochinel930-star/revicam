import Link from 'next/link';
import { SITE_NAME } from '@/lib/config';
import { getClasses, getMatieresDeClasse } from '@/lib/queries';

export const revalidate = 3600;

export default async function Accueil() {
  const classes = await getClasses();
  const premiereD = classes.find((c) => c.slug === 'premiere-d') ?? classes[0];
  const matieres = premiereD ? await getMatieresDeClasse(premiereD.id) : [];

  return (
    <div>
      {/* ── Hero ── */}
      <section className="-mx-3 bg-navy px-4 py-10 text-center text-white">
        <h1 className="mx-auto max-w-xl text-2xl font-bold leading-snug sm:text-3xl">
          Lis ton cours. Compose comme en salle d’examen.
          <span className="text-gold"> Reçois ta note immédiatement.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-200">
          {SITE_NAME}, la plateforme 100 % gratuite de révision pour le secondaire au
          Cameroun. Sans inscription. Objectif : ≥ 10/20 dans <em>toutes</em> les matières
          au Probatoire.
        </p>
        <Link
          href="/cours/premiere-d"
          className="mt-5 inline-block rounded-lg bg-gold px-6 py-3 text-base font-bold text-navy shadow hover:opacity-90"
        >
          Commencer à réviser →
        </Link>
      </section>

      {/* ── Les 3 piliers ── */}
      <section className="mt-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/epreuves" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-navy">
            <p className="text-2xl">📄</p>
            <h2 className="mt-1 font-bold text-navy">Épreuves</h2>
            <p className="mt-1 text-xs text-slate-600">
              Séquentielles, examens blancs et sujets officiels, à consulter, télécharger… ou composer en ligne.
            </p>
          </Link>
          <Link href="/cours" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-navy">
            <p className="text-2xl">📘</p>
            <h2 className="mt-1 font-bold text-navy">Cours & Fiches</h2>
            <p className="mt-1 text-xs text-slate-600">
              Cours APC conformes aux programmes MINESEC, QCM corrigés instantanément, fiches mémo.
            </p>
          </Link>
          <Link href="/composition" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-navy">
            <p className="text-2xl">✍️</p>
            <h2 className="mt-1 font-bold text-navy">Salle de Composition</h2>
            <p className="mt-1 text-xs text-slate-600">
              Chrono officiel, correction automatique + IA, note sur 20 et diagnostic immédiats.
            </p>
          </Link>
        </div>
      </section>

      {/* ── Matières Première D ── */}
      {premiereD && matieres.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold text-navy">{premiereD.nom} — tes matières</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {matieres.map((m) => (
              <Link
                key={m.id}
                href={`/cours/${premiereD.slug}/${m.slug}`}
                className="rounded-lg border-t-4 bg-white p-3 text-center text-sm font-semibold shadow-sm transition hover:shadow"
                style={{ borderTopColor: m.couleur_hex }}
              >
                <span className="block text-xl">{m.icone}</span>
                {m.nom}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Comment ça marche ── */}
      <section className="mt-8 rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-navy">Comment ça marche ?</h2>
        <ol className="mt-3 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-bold text-white">1</span>
            <span><strong>Révise ton cours</strong> — leçons conformes APC, exemples 100 % camerounais, fiche mémo téléchargeable, QCM corrigé à l’instant.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-bold text-white">2</span>
            <span><strong>Compose comme à l’examen</strong> — chrono officiel, copie numérique, remise… et correction immédiate, y compris de tes réponses rédigées.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-navy">3</span>
            <span><strong>Cible tes faiblesses</strong> — le diagnostic te dit quelles leçons réviser AVANT le jour J, et tu recomposes jusqu’à dépasser 10/20 partout.</span>
          </li>
        </ol>
      </section>

      <p className="mt-8 text-center text-xs text-slate-400">
        100 % gratuit · Sans inscription · Pensé pour les petits forfaits data ·{' '}
        <Link href="/a-propos" className="underline">À propos</Link>
      </p>
    </div>
  );
}
