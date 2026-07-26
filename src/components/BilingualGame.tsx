'use client';

// Jeu bilingue FR ↔ EN : appariement par simple toucher (tap-to-match),
// adapté aux petits écrans tactiles.

import { useMemo, useState } from 'react';

interface Props {
  paires: { fr: string; en: string }[];
}

function melanger<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BilingualGame({ paires }: Props) {
  const [cle, setCle] = useState(0);
  // `cle` est une dépendance VOLONTAIRE : l'incrémenter (setCle, bouton « Rejouer »)
  // force useMemo à re-mélanger les paires. eslint-plugin-react-hooks la signale
  // comme « inutile » (non lue dans le corps du memo) — avertissement CONSERVÉ
  // sciemment : la retirer casserait le re-mélange. Ne pas « corriger ».
  const enMelanges = useMemo(() => melanger(paires.map((p) => p.en)), [paires, cle]);
  const [selFr, setSelFr] = useState<string | null>(null);
  const [trouves, setTrouves] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);

  function choisirFr(fr: string) {
    if (trouves.has(fr)) return;
    setSelFr(fr === selFr ? null : fr);
    setErreur(null);
  }

  function choisirEn(en: string) {
    if (!selFr) return;
    const paire = paires.find((p) => p.fr === selFr);
    if (paire && paire.en === en) {
      setTrouves((t) => new Set(t).add(selFr));
      setSelFr(null);
      setErreur(null);
    } else {
      setErreur(en);
      setTimeout(() => setErreur(null), 700);
    }
  }

  const gagne = trouves.size === paires.length;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Touche un mot en français, puis sa traduction en anglais.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {paires.map((p) => (
            <button
              key={p.fr}
              type="button"
              onClick={() => choisirFr(p.fr)}
              disabled={trouves.has(p.fr)}
              className={`block w-full rounded-md border px-2 py-1.5 text-left text-sm ${
                trouves.has(p.fr)
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : selFr === p.fr
                    ? 'border-navy bg-maths-bg'
                    : 'border-slate-300 bg-white'
              }`}
            >
              {p.fr}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {enMelanges.map((en) => {
            const trouve = paires.some((p) => p.en === en && trouves.has(p.fr));
            return (
              <button
                key={en}
                type="button"
                onClick={() => choisirEn(en)}
                disabled={trouve}
                className={`block w-full rounded-md border px-2 py-1.5 text-left text-sm ${
                  trouve
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : erreur === en
                      ? 'border-red-500 bg-red-50'
                      : 'border-slate-300 bg-white'
                }`}
              >
                {en}
              </button>
            );
          })}
        </div>
      </div>
      {gagne && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          🎉 Bravo ! Tu maîtrises le vocabulaire bilingue de cette leçon.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setTrouves(new Set());
          setSelFr(null);
          setCle((k) => k + 1);
        }}
        className="mt-3 rounded-md border border-navy px-4 py-1.5 text-sm font-medium text-navy hover:bg-maths-bg"
      >
        Rejouer
      </button>
    </div>
  );
}
