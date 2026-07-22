'use client';

// « Télécharger la fiche PDF » : ouvre le dialogue d'impression du navigateur
// (Enregistrer en PDF sur Android/desktop). Une feuille de style print masque
// tout sauf la fiche — zéro bibliothèque PDF embarquée.

export default function BoutonImprimerFiche() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-3 rounded-md border border-gold bg-white px-4 py-1.5 text-sm font-medium text-slate-800 hover:bg-gold-bg"
    >
      📄 Télécharger la fiche PDF
    </button>
  );
}
