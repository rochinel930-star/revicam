import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import QcmPlayer from '@/components/QcmPlayer';
import BilingualGame from '@/components/BilingualGame';
import MarqueVue from '@/components/MarqueVue';
import BoutonImprimerFiche from '@/components/BoutonImprimerFiche';
import Flashcards from '@/components/Flashcards';
import VraiFaux from '@/components/VraiFaux';
import ExplainPanel from '@/components/ExplainPanel';
import QuestionsOuvertes from '@/components/QuestionsOuvertes';
import { mdToHtml } from '@/lib/markdown';
import { construireContexteLecon, contexteVersJsonLd } from '@/lib/lesson-context';
import { getArtefactsCourants } from '@/lib/ai/artifacts-repo';
import { preparerOutils, aDesOutils } from '@/lib/ai/prepare-artifacts';
import { TYPE_EPREUVE_LABELS } from '@/lib/types';
import {
  getClasse, getClasses, getMatiere, getMatieresDeClasse, getModules,
  getLecon, getLeconsDesModules, getEpreuvesDeLaLecon, getCompositionsDeLaLecon,
} from '@/lib/queries';

export const revalidate = 3600;

interface Params {
  classe: string;
  matiere: string;
  module: string; // "module-2"
  lecon: string;  // slug
}

export async function generateStaticParams() {
  const classes = await getClasses();
  const params: Params[] = [];
  for (const c of classes) {
    const matieres = await getMatieresDeClasse(c.id);
    for (const m of matieres) {
      const modules = await getModules(c.id, m.id);
      const lecons = await getLeconsDesModules(modules.map((mo) => mo.id));
      for (const l of lecons) {
        const mo = modules.find((x) => x.id === l.module_id)!;
        params.push({ classe: c.slug, matiere: m.slug, module: `module-${mo.numero}`, lecon: l.slug });
      }
    }
  }
  return params;
}

async function resoudre(params: Params) {
  const numeroModule = Number(params.module.replace(/^module-/, ''));
  if (!Number.isInteger(numeroModule)) return null;
  const [classe, matiere] = await Promise.all([getClasse(params.classe), getMatiere(params.matiere)]);
  if (!classe || !matiere) return null;
  const modules = await getModules(classe.id, matiere.id);
  const module_ = modules.find((m) => m.numero === numeroModule);
  if (!module_) return null;
  const lecon = await getLecon(module_.id, params.lecon);
  if (!lecon) return null;
  return { classe, matiere, modules, module_, lecon };
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const r = await resoudre(await params);
  if (!r) return { title: 'Leçon' };
  return {
    title: `L${r.lecon.numero} ${r.lecon.titre} — ${r.matiere.nom} ${r.classe.nom}`,
    description: `Cours, QCM corrigé et exercices type examen : ${r.lecon.titre} (${r.matiere.nom}, ${r.classe.nom}).`,
  };
}

const SOMMAIRE = [
  { id: 'objectifs', label: '🎯 Objectifs' },
  { id: 'cours', label: '📖 Cours' },
  { id: 'essentiel', label: '🧠 Essentiel' },
  { id: 'bilingue', label: '🌍 Bilingue' },
  { id: 'ressources', label: '✅ Ressources' },
  { id: 'outils', label: '🤖 Outils IA' },
  { id: 'competences', label: '💪 Compétences' },
  { id: 'sujets', label: '📄 Sujets liés' },
];

export default async function PageLecon({ params }: { params: Promise<Params> }) {
  const r = await resoudre(await params);
  if (!r) notFound();
  const { classe, matiere, modules, module_, lecon } = r;

  const miettes = [
    { href: '/cours', label: 'Cours & Fiches' },
    { href: `/cours/${classe.slug}`, label: classe.nom },
    { href: `/cours/${classe.slug}/${matiere.slug}`, label: matiere.nom },
    { label: `L${lecon.numero}` },
  ];

  // ── Écran « en rédaction » ────────────────────────────────────────
  if (!lecon.publie || !lecon.contenu_mdx) {
    return (
      <div>
        <Breadcrumb miettes={miettes} />
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-4xl">📝</p>
          <h1 className="mt-2 text-xl font-bold text-navy">
            Leçon {lecon.numero} — {lecon.titre}
          </h1>
          <p className="mt-2 text-slate-600">Cette leçon arrive bientôt.</p>
          {lecon.objectifs.length > 0 && (
            <div className="mx-auto mt-4 max-w-md rounded-md bg-maths-bg p-4 text-left text-sm">
              <p className="mb-1 font-semibold text-navy">À la fin de cette leçon, tu sauras :</p>
              <ul className="list-disc pl-5">
                {lecon.objectifs.map((o, i) => (<li key={i}>{o}</li>))}
              </ul>
            </div>
          )}
          <Link
            href={`/cours/${classe.slug}/${matiere.slug}`}
            className="mt-5 inline-block rounded-md bg-navy px-4 py-2 text-sm font-medium text-white"
          >
            ← Retour au programme de {matiere.nom}
          </Link>
        </div>
      </div>
    );
  }

  // ── Données annexes ───────────────────────────────────────────────
  const toutesLecons = await getLeconsDesModules(modules.map((m) => m.id));
  const ordonnee = toutesLecons.sort((a, b) => a.numero - b.numero);
  const idx = ordonnee.findIndex((l) => l.id === lecon.id);
  const prec = idx > 0 ? ordonnee[idx - 1] : null;
  const suiv = idx < ordonnee.length - 1 ? ordonnee[idx + 1] : null;
  const hrefLecon = (l: (typeof ordonnee)[number]) => {
    const mo = modules.find((m) => m.id === l.module_id)!;
    return `/cours/${classe.slug}/${matiere.slug}/module-${mo.numero}/${l.slug}`;
  };

  const [sujets, compositionsLiees] = await Promise.all([
    getEpreuvesDeLaLecon(lecon.id),
    getCompositionsDeLaLecon(lecon.id),
  ]);

  // Contexte « leçon courante » (Phase P7) : ancrage IA + JSON-LD SEO.
  const contexte = construireContexteLecon({
    lecon,
    matiere: matiere.nom,
    classe: classe.nom,
    chapitre: `Module ${module_.numero} — ${module_.titre}`,
  });

  // Outils IA par leçon (Phase P8) : LECTURE du cache (0 appel IA au runtime).
  // Résilient : aucun outil si non générés / migration non appliquée.
  const outils = preparerOutils(await getArtefactsCourants(lecon.id, contexte.signature));

  return (
    <div data-lecon-signature={contexte.signature}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contexteVersJsonLd(contexte)) }}
      />
      <MarqueVue leconId={lecon.id} />
      <Breadcrumb miettes={miettes} />

      {/* ── En-tête ── */}
      <header className="rounded-lg border-l-4 bg-white p-4 shadow-sm" style={{ borderLeftColor: matiere.couleur_hex }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: matiere.couleur_hex }}>
          {matiere.nom} · Module {module_.numero} — {module_.titre}
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
          Leçon {lecon.numero} — {lecon.titre}
        </h1>
        {lecon.duree_lecture_min && (
          <p className="mt-1 text-xs text-slate-500">⏱ {lecon.duree_lecture_min} min de lecture</p>
        )}
      </header>

      {/* ── Sommaire sticky ── */}
      <nav
        aria-label="Sommaire de la leçon"
        className="sticky top-12 z-30 -mx-3 mt-3 overflow-x-auto whitespace-nowrap border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur"
      >
        {SOMMAIRE.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="mr-2 inline-block rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-navy hover:text-navy">
            {s.label}
          </a>
        ))}
      </nav>

      {/* ── 🎯 Objectifs ── */}
      <section id="objectifs" className="mt-5 scroll-mt-24">
        <div className="rounded-lg bg-maths-bg p-4">
          <h2 className="font-bold text-navy">🎯 À la fin de cette leçon, tu sauras…</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {lecon.objectifs.map((o, i) => (<li key={i}>{o}</li>))}
          </ul>
        </div>
      </section>

      {/* ── 📖 Cours ── */}
      <section id="cours" className="mt-6 scroll-mt-24">
        <h2 className="mb-2 text-lg font-bold text-navy">📖 Cours</h2>
        <div className="prose rounded-lg bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(lecon.contenu_mdx) }} />
      </section>

      {/* ── 🧠 L'essentiel ── */}
      {lecon.essentiel_mdx && (
        <section id="essentiel" className="mt-6 scroll-mt-24">
          <h2 className="mb-2 text-lg font-bold text-navy">🧠 L’essentiel à retenir</h2>
          <div className="fiche-print rounded-lg border border-gold bg-gold-bg p-4">
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
              Fiche mémo · L{lecon.numero} {lecon.titre} · {matiere.nom} {classe.nom}
            </p>
            <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(lecon.essentiel_mdx) }} />
          </div>
          <BoutonImprimerFiche />
        </section>
      )}

      {/* ── 🌍 Jeu bilingue ── */}
      {lecon.jeu_bilingue && lecon.jeu_bilingue.length > 0 && (
        <section id="bilingue" className="mt-6 scroll-mt-24">
          <h2 className="mb-2 text-lg font-bold text-navy">🌍 Jeu bilingue français ↔ english</h2>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <BilingualGame paires={lecon.jeu_bilingue} />
          </div>
        </section>
      )}

      {/* ── ✅ Évaluation des ressources ── */}
      {lecon.qcm && lecon.qcm.length > 0 && (
        <section id="ressources" className="mt-6 scroll-mt-24">
          <h2 className="mb-1 text-lg font-bold text-navy">✅ Évaluation des ressources</h2>
          <p className="mb-3 text-sm text-slate-600">
            {lecon.qcm.length} questions, correction instantanée. Vise au moins 10/20 !
          </p>
          <QcmPlayer leconId={lecon.id} items={lecon.qcm} />
        </section>
      )}

      {/* ── 🤖 Outils IA par leçon (cache mutualisé, 0 IA au runtime) ── */}
      {aDesOutils(outils) && (
        <section id="outils" className="mt-6 scroll-mt-24">
          <h2 className="mb-1 text-lg font-bold text-navy">🤖 Outils de révision IA</h2>
          <p className="mb-3 text-sm text-slate-600">
            Générés une fois à partir de cette leçon, partagés par tous les élèves.
          </p>

          {outils.qcm && outils.qcm.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 font-bold text-slate-800">Quiz express</h3>
              <QcmPlayer leconId={`${lecon.id}:ia-qcm`} items={outils.qcm} />
            </div>
          )}

          {outils.flashcards && outils.flashcards.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 font-bold text-slate-800">🃏 Flashcards</h3>
              <Flashcards cartes={outils.flashcards} />
            </div>
          )}

          {outils.vraiFaux && outils.vraiFaux.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 font-bold text-slate-800">✔️ Vrai / Faux</h3>
              <VraiFaux items={outils.vraiFaux} />
            </div>
          )}

          {outils.explications && outils.explications.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 font-bold text-slate-800">💡 Expliqué autrement</h3>
              <ExplainPanel items={outils.explications} />
            </div>
          )}

          {outils.questionsOuvertes && outils.questionsOuvertes.length > 0 && outils.qoSignature && (
            <div className="mb-2">
              <h3 className="mb-2 font-bold text-slate-800">✍️ Questions ouvertes (correction IA)</h3>
              <QuestionsOuvertes
                leconId={lecon.id}
                signature={outils.qoSignature}
                items={outils.questionsOuvertes}
              />
            </div>
          )}
        </section>
      )}

      {/* ── 💪 Évaluation des compétences ── */}
      {lecon.exercices && lecon.exercices.length > 0 && (
        <section id="competences" className="mt-6 scroll-mt-24">
          <h2 className="mb-1 text-lg font-bold text-navy">💪 Évaluation des compétences</h2>
          <p className="mb-3 text-sm text-slate-600">
            Exercices type examen. Cherche d’abord, le corrigé n’est qu’à un clic.
          </p>
          <div className="space-y-4">
            {lecon.exercices.map((ex, i) => (
              <article key={i} className="rounded-lg bg-white p-4 shadow-sm">
                <h3 className="font-bold text-slate-800">{ex.titre}</h3>
                <div className="prose mt-2 text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(ex.enonce_mdx) }} />
                {ex.corrige_mdx && (
                  <details className="mt-3">
                    <summary className="cursor-pointer rounded-md bg-navy px-4 py-2 text-center text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
                      Voir le corrigé
                    </summary>
                    <div className="prose mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(ex.corrige_mdx) }} />
                  </details>
                )}
              </article>
            ))}
          </div>
          {compositionsLiees.length > 0 && (
            <div className="mt-4 rounded-lg border border-navy bg-maths-bg p-4">
              <p className="text-sm font-medium text-navy">✍️ Prêt(e) à composer sur cette leçon ?</p>
              {compositionsLiees.map((c) => (
                <Link key={c.id} href={`/composition/${c.id}/consignes`} className="mt-2 block text-sm font-semibold text-navy underline">
                  {c.titre} ({c.duree_minutes} min) →
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 📄 Sujets liés ── */}
      <section id="sujets" className="mt-6 scroll-mt-24">
        <h2 className="mb-2 text-lg font-bold text-navy">📄 Sujets liés dans le catalogue</h2>
        {sujets.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune épreuve du catalogue ne porte encore sur cette leçon.</p>
        ) : (
          <ul className="space-y-2">
            {sujets.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{e.titre}</span>
                  <span className="ml-2 text-xs text-slate-500">{TYPE_EPREUVE_LABELS[e.type]} · {e.annee}</span>
                </span>
                <Link href={`/epreuves?classe=${classe.slug}&matiere=${matiere.slug}`} className="text-xs font-semibold text-navy underline">
                  Voir dans le catalogue →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Navigation bas de page ── */}
      <nav className="mt-8 flex items-stretch justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
        {prec ? (
          <Link href={hrefLecon(prec)} className="flex-1 rounded-md border border-slate-200 bg-white p-3 hover:border-navy">
            <span className="block text-xs text-slate-400">← Leçon précédente</span>
            <span className="font-medium text-slate-800">L{prec.numero} {prec.titre}</span>
          </Link>
        ) : <span className="flex-1" />}
        {suiv ? (
          <Link href={hrefLecon(suiv)} className="flex-1 rounded-md border border-slate-200 bg-white p-3 text-right hover:border-navy">
            <span className="block text-xs text-slate-400">Leçon suivante →</span>
            <span className="font-medium text-slate-800">L{suiv.numero} {suiv.titre}</span>
          </Link>
        ) : <span className="flex-1" />}
      </nav>
    </div>
  );
}
