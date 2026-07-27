'use client';

// Flashcards (P8). Le verso (HTML) est PRÉ-RENDU côté serveur (render-at-write) :
// ce composant ne gère que l'interaction (retournement). Zéro moteur de rendu
// côté client.

import { useState } from 'react';

export interface CarteFlash {
  recto: string;
  versoHtml: string;
}

function Carte({ carte }: { carte: CarteFlash }) {
  const [retournee, setRetournee] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setRetournee((r) => !r)}
      className="min-h-24 w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-navy"
      aria-pressed={retournee}
    >
      {retournee ? (
        <div className="prose text-sm" dangerouslySetInnerHTML={{ __html: carte.versoHtml }} />
      ) : (
        <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800">
          {carte.recto}
          <span className="text-xs text-slate-400">clique pour voir →</span>
        </span>
      )}
    </button>
  );
}

export default function Flashcards({ cartes }: { cartes: CarteFlash[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cartes.map((c, i) => (
        <Carte key={i} carte={c} />
      ))}
    </div>
  );
}
