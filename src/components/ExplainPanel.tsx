// Explications « autrement » (P8). Contenu PRÉ-RENDU côté serveur.
// Accordéon HTML natif (details/summary) — aucun JS requis.

export interface ItemExplication {
  titre: string;
  corpsHtml: string;
}

export default function ExplainPanel({ items }: { items: ItemExplication[] }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <details key={i} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
            💡 {it.titre}
          </summary>
          <div className="prose mt-2 text-sm" dangerouslySetInnerHTML={{ __html: it.corpsHtml }} />
        </details>
      ))}
    </div>
  );
}
