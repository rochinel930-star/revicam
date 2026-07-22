// Pilier 1 — catalogue d'épreuves, filtres combinables via l'URL
// (partageable WhatsApp). SSR à chaque requête.
import Link from 'next/link';
import type { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import { getEpreuves, getClasses, getMatieres, getCompositionDeLEpreuve } from '@/lib/queries';
import { TYPE_EPREUVE_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Épreuves — Catalogue',
  description:
    'Épreuves séquentielles, examens blancs et sujets officiels du Probatoire, à consulter, télécharger ou composer en ligne.',
};

const TYPES = Object.entries(TYPE_EPREUVE_LABELS);
const SERIES = ['A', 'C', 'D', 'TI'];

interface Filtres {
  classe?: string;
  matiere?: string;
  type?: string;
  annee?: string;
  serie?: string;
  etablissement?: string;
}

function urlAvec(filtres: Filtres, patch: Partial<Filtres>): string {
  const params = new URLSearchParams();
  const next = { ...filtres, ...patch };
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/epreuves?${qs}` : '/epreuves';
}

export default async function PageEpreuves({
  searchParams,
}: {
  searchParams: Promise<Filtres>;
}) {
  const filtres = await searchParams;
  const [classes, matieres, epreuves] = await Promise.all([
    getClasses(),
    getMatieres(),
    getEpreuves({
      classe: filtres.classe,
      matiere: filtres.matiere,
      type: filtres.type,
      annee: filtres.annee ? Number(filtres.annee) : undefined,
      serie: filtres.serie,
      etablissement: filtres.etablissement,
    }),
  ]);

  // Pont Pilier 1 → Pilier 3 : composition liée des épreuves composables.
  const compositions = new Map<string, string>();
  await Promise.all(
    epreuves.filter((e) => e.composable).map(async (e) => {
      const c = await getCompositionDeLEpreuve(e.id);
      if (c) compositions.set(e.id, c.id);
    })
  );

  const annees = [...new Set(epreuves.map((e) => e.annee))].sort((a, b) => b - a);
  const anneesChoix = annees.length > 0 ? annees : [new Date().getFullYear()];

  const Chip = ({ actif, href, children }: { actif: boolean; href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      className={`inline-block rounded-full border px-3 py-1 text-xs font-medium transition ${
        actif ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-navy'
      }`}
    >
      {children}
    </Link>
  );

  return (
    <div>
      <Breadcrumb miettes={[{ label: 'Épreuves' }]} />
      <h1 className="mb-1 text-2xl font-bold text-navy">📄 Catalogue d’épreuves</h1>
      <p className="mb-4 text-sm text-slate-600">
        Séquentielles, compositions, examens blancs et sujets officiels. Les épreuves marquées
        ✍️ se composent en ligne avec correction immédiate.
      </p>

      {/* ── Filtres combinables ── */}
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Classe</span>
          <Chip actif={!filtres.classe} href={urlAvec(filtres, { classe: undefined })}>Toutes</Chip>
          {classes.map((c) => (
            <Chip key={c.id} actif={filtres.classe === c.slug} href={urlAvec(filtres, { classe: c.slug })}>{c.nom}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Matière</span>
          <Chip actif={!filtres.matiere} href={urlAvec(filtres, { matiere: undefined })}>Toutes</Chip>
          {matieres.map((m) => (
            <Chip key={m.id} actif={filtres.matiere === m.slug} href={urlAvec(filtres, { matiere: m.slug })}>{m.nom}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Type</span>
          <Chip actif={!filtres.type} href={urlAvec(filtres, { type: undefined })}>Tous</Chip>
          {TYPES.map(([slug, label]) => (
            <Chip key={slug} actif={filtres.type === slug} href={urlAvec(filtres, { type: slug })}>{label}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Série</span>
          <Chip actif={!filtres.serie} href={urlAvec(filtres, { serie: undefined })}>Toutes</Chip>
          {SERIES.map((s) => (
            <Chip key={s} actif={filtres.serie === s} href={urlAvec(filtres, { serie: s })}>{s}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Année</span>
          <Chip actif={!filtres.annee} href={urlAvec(filtres, { annee: undefined })}>Toutes</Chip>
          {anneesChoix.map((a) => (
            <Chip key={a} actif={filtres.annee === String(a)} href={urlAvec(filtres, { annee: String(a) })}>{a}</Chip>
          ))}
        </div>
        <form action="/epreuves" method="get" className="flex flex-wrap items-center gap-1.5">
          {Object.entries(filtres).map(([k, v]) =>
            v && k !== 'etablissement' ? <input key={k} type="hidden" name={k} value={v} /> : null
          )}
          <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Établiss.</span>
          <input
            type="search"
            name="etablissement"
            defaultValue={filtres.etablissement ?? ''}
            placeholder="Collège Vogt, Jean Tabi, Libermann…"
            className="w-56 rounded-full border border-slate-300 px-3 py-1 text-xs focus:border-navy focus:outline-none"
          />
          <button type="submit" className="rounded-full bg-navy px-3 py-1 text-xs font-medium text-white">
            Filtrer
          </button>
        </form>
      </div>

      {/* ── Cartes épreuves ── */}
      <p className="mt-4 text-xs text-slate-500">
        {epreuves.length} épreuve{epreuves.length > 1 ? 's' : ''} trouvée{epreuves.length > 1 ? 's' : ''}
      </p>
      <ul className="mt-2 space-y-3">
        {epreuves.map((e) => {
          const couleur = e.matieres?.couleur_hex ?? '#64748B';
          const compositionId = compositions.get(e.id);
          return (
            <li key={e.id} className="rounded-lg border-l-4 bg-white p-4 shadow-sm" style={{ borderLeftColor: couleur }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{e.titre}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span className="rounded-sm px-1.5 py-0.5 font-semibold text-white" style={{ backgroundColor: couleur }}>
                      {e.matieres?.nom}
                    </span>
                    <span>{TYPE_EPREUVE_LABELS[e.type]}{e.numero_sequence ? ` n°${e.numero_sequence}` : ''}</span>
                    <span>· {e.annee}</span>
                    {e.serie && <span>· Série {e.serie}</span>}
                    {e.etablissement && <span>· {e.etablissement}</span>}
                    <span>· {e.classes?.nom}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {e.pdf_url && (
                  <>
                    <a
                      href={e.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-navy"
                    >
                      👁 Voir en ligne
                    </a>
                    <a
                      href={e.pdf_url}
                      download
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-navy"
                    >
                      ⬇ Télécharger PDF
                    </a>
                  </>
                )}
                {compositionId && (
                  <Link
                    href={`/composition/${compositionId}/consignes`}
                    className="rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-mid"
                  >
                    ✍️ Composer cette épreuve →
                  </Link>
                )}
                {!e.pdf_url && !compositionId && (
                  <span className="text-xs text-slate-400">Bientôt disponible</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {epreuves.length === 0 && (
        <p className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Aucune épreuve ne correspond à ces filtres.{' '}
          <Link href="/epreuves" className="font-semibold text-navy underline">Tout afficher</Link>
        </p>
      )}
    </div>
  );
}
