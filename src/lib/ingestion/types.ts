// Types du pipeline d'ingestion V2 — Phase P4.

export type TypeArtefact = 'epreuve' | 'lecon';

/** Ressource brute entrante (avant tout traitement). */
export interface Artefact {
  type: TypeArtefact;
  source: string;      // origine (nom de fichier, enseignant…)
  mime: string;        // ex. 'text/markdown', 'application/pdf', 'image/png'
  contenu: string;     // texte, Markdown, ou base64 pour le binaire
  hash?: string;       // rempli par l'étape intake
}

/** Question extraite (schéma canonique, aligné sur la table questions). */
export interface QuestionExtraite {
  ordre: number;
  type: 'qcm' | 'libre';
  enonce_mdx: string;
  bareme: number;
  options?: string[];
  bonnes_reponses?: number[];   // indices — jamais servis au client
  corrige_type_mdx?: string | null;
}

/** Extraction canonique d'une épreuve (cible de persistance en staging). */
export interface ExtractionEpreuve {
  titre: string;
  classe: string;   // slug
  matiere: string;  // slug
  type: string;     // type d'épreuve
  annee: number;
  serie?: string | null;
  session?: string | null;
  questions: QuestionExtraite[];
  provenance: Record<string, unknown>;
}

export interface Probleme {
  code: string;
  message: string;
  champ?: string;
}

export interface Referentiel {
  classes: string[];   // slugs connus
  matieres: string[];  // slugs connus
  types: string[];     // types d'épreuve autorisés
}

export type EtapePipeline =
  | 'intake'
  | 'ocr'
  | 'extract'
  | 'validate'
  | 'normalize'
  | 'qc'
  | 'score'
  | 'enrich'
  | 'persist';

export interface ResultatEtape<T> {
  etape: EtapePipeline;
  ok: boolean;
  data?: T;
  problemes: Probleme[];
}

export interface ResultatIngestion {
  hash: string;
  ok: boolean;
  etapeEchec?: EtapePipeline;
  problemes: Probleme[];
  score: number;                 // 0..1
  extraction?: ExtractionEpreuve;
  suggestions: string[];         // liens graphe suggérés (codes de notions)
  aRevoir: boolean;              // toujours true : promotion = décision humaine
}
