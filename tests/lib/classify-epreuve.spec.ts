// Unitaire du classifieur d'en-tête d'épreuve (déterministe, gratuit) — P10.

import { describe, it, expect } from 'vitest';
import { classifierEntete, construireTitre } from '@/lib/ingestion/classify-epreuve';

describe('classifierEntete — en-têtes camerounais réels', () => {
  it('séquentielle maths Terminale C', () => {
    const r = classifierEntete(
      'MINESEC — Lycée de Nkolbisson — Épreuve de Mathématiques — Terminale C — Séquence N°2 — Année scolaire 2022-2023 — Durée 4h'
    );
    expect(r.champs.matiere).toBe('mathematiques');
    expect(r.champs.niveau).toBe('terminale');
    expect(r.champs.serie).toBe('C');
    expect(r.champs.type).toBe('sequentielle');
    expect(r.champs.numero_sequence).toBe(2);
    expect(r.champs.annee).toBe(2022);
    expect(r.champs.etablissement).toMatch(/Lyc[ée]e de Nkolbisson/);
    expect(r.confiance).toBeGreaterThanOrEqual(0.9);
  });

  it('composition physique Première D, 2e trimestre (ne confond pas avec Première)', () => {
    const r = classifierEntete('Collège Vogt — Composition du 2e trimestre — Physique — Première D — 2023');
    expect(r.champs.matiere).toBe('physique');
    expect(r.champs.niveau).toBe('premiere');
    expect(r.champs.serie).toBe('D');
    expect(r.champs.type).toBe('composition');
    expect(r.champs.trimestre).toBe(2);
  });

  it('examen blanc probatoire SVT', () => {
    const r = classifierEntete('Examen Blanc Probatoire — SVT — Première C — Lycée Général Leclerc — 2024');
    expect(r.champs.type).toBe('blanc');
    expect(r.champs.matiere).toBe('svt');
    expect(r.champs.niveau).toBe('premiere');
    expect(r.champs.serie).toBe('C');
  });

  it('baccalauréat philosophie Terminale A, session normale', () => {
    const r = classifierEntete('Baccalauréat — Session Normale — Épreuve de Philosophie — Terminale A — 2021');
    expect(r.champs.type).toBe('baccalaureat');
    expect(r.champs.matiere).toBe('philosophie');
    expect(r.champs.niveau).toBe('terminale');
    expect(r.champs.serie).toBe('A');
    expect(r.champs.session).toBe('normale');
  });

  it('nom de fichier « bizarre » seul (en-tête vide)', () => {
    const r = classifierEntete('', 'epr_maths_6e_seq1_2023.pdf');
    expect(r.champs.matiere).toBe('mathematiques');
    expect(r.champs.niveau).toBe('sixieme');
    expect(r.champs.type).toBe('sequentielle');
    expect(r.champs.numero_sequence).toBe(1);
  });

  it('confiance faible + champs manquants quand rien n’est reconnu', () => {
    const r = classifierEntete('Document sans indication utile');
    expect(r.confiance).toBeLessThan(0.5);
    expect(r.manquants).toContain('matiere');
  });
});

describe('construireTitre', () => {
  it('assemble un nom clair et lisible', () => {
    const titre = construireTitre({
      matiere: 'mathematiques',
      niveau: 'terminale',
      serie: 'C',
      type: 'sequentielle',
      numero_sequence: 2,
      trimestre: null,
      annee: 2023,
      etablissement: 'Lycée de Nkolbisson',
      session: null,
    });
    expect(titre).toBe('Mathématiques — Lycée de Nkolbisson — Séquence N°2 — Terminale C — 2023');
  });
});
