'use client';

// Vrai/Faux (P8). Affirmation et explication PRÉ-RENDUES côté serveur.
// Correction instantanée côté client (formatif).

import { useState } from 'react';

export interface ItemVF {
  affirmationHtml: string;
  correct: boolean;
  explicationHtml: string | null;
}

function Item({ item }: { item: ItemVF }) {
  const [choix, setChoix] = useState<boolean | null>(null);
  const repondu = choix !== null;
  const juste = repondu && choix === item.correct;

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: item.affirmationHtml }} />
      <div className="mt-3 flex gap-2">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={repondu}
            onClick={() => setChoix(v)}
            className={`rounded-md border px-4 py-1.5 text-sm font-semibold transition disabled:opacity-70 ${
              repondu && v === item.correct
                ? 'border-green-600 bg-green-50 text-green-700'
                : repondu && v === choix
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : 'border-slate-300 hover:border-navy'
            }`}
          >
            {v ? 'Vrai' : 'Faux'}
          </button>
        ))}
      </div>
      {repondu && (
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
          <p className={`font-semibold ${juste ? 'text-green-700' : 'text-red-600'}`}>
            {juste ? '✅ Correct' : '❌ Incorrect'}
          </p>
          {item.explicationHtml && (
            <div className="prose mt-1 text-sm" dangerouslySetInnerHTML={{ __html: item.explicationHtml }} />
          )}
        </div>
      )}
    </li>
  );
}

export default function VraiFaux({ items }: { items: ItemVF[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <Item key={i} item={it} />
      ))}
    </ul>
  );
}
