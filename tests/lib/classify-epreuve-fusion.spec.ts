// Unitaire de la fusion heuristique + IA — P10.

import { describe, it, expect } from 'vitest';
import { fusionner, versClassification } from '@/lib/ingestion/classify-epreuve-ia';
import type { ChampsEpreuve } from '@/lib/ingestion/classify-epreuve';

const vide: ChampsEpreuve = {
  matiere: null, niveau: null, serie: null, type: null,
  numero_sequence: null, trimestre: null, annee: null, etablissement: null, session: null,
};

describe('fusionner', () => {
  it('complète les champs manquants sans écraser l’heuristique', () => {
    const heur: ChampsEpreuve = { ...vide, matiere: 'physique', type: 'sequentielle' };
    const ia: ChampsEpreuve = { ...vide, matiere: 'chimie', niveau: 'terminale', serie: 'C' };
    const f = fusionner(heur, ia);
    expect(f.matiere).toBe('physique'); // heuristique conservée
    expect(f.niveau).toBe('terminale'); // complété par l'IA
    expect(f.serie).toBe('C');
    expect(f.type).toBe('sequentielle');
  });
});

describe('versClassification', () => {
  it('recalcule confiance, titre et manquants', () => {
    const c: ChampsEpreuve = { ...vide, matiere: 'mathematiques', niveau: 'premiere', serie: 'D', type: 'composition', trimestre: 1 };
    const r = versClassification(c, 'fusion');
    expect(r.confiance).toBeCloseTo(1, 5);
    expect(r.source).toBe('fusion');
    expect(r.manquants).toHaveLength(0);
    expect(r.titre).toContain('Première D');
  });
});
