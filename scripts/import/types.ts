// Types du pipeline d'import de contenu.

export interface StructureImport {
  classes: { slug: string; nom: string; ordre: number }[];
  matieres: { slug: string; nom: string; couleur: string; icone?: string }[];
  classe_matieres: { classe: string; matiere: string; coefficient?: number }[];
  modules: { classe: string; matiere: string; numero: number; titre: string }[];
}

export interface QcmItem {
  enonce_mdx: string;
  options: string[];
  bonnes: number[];
  explication_mdx?: string;
}

export interface Exercice {
  titre: string;
  enonce_mdx: string;
  corrige_mdx?: string;
}

export interface LeconImport {
  fichier: string;
  classe: string;
  matiere: string;
  module: number;
  numero: number;
  titre: string;
  slug: string;
  duree?: number;
  publie: boolean;
  objectifs: string[];
  contenu_mdx?: string;
  essentiel_mdx?: string;
  jeu_bilingue?: { fr: string; en: string }[];
  qcm?: QcmItem[];
  exercices?: Exercice[];
}

export interface QuestionImport {
  type: 'qcm' | 'libre';
  enonce: string;
  options?: string[];
  bonnes_reponses?: number[];
  corrige_type?: string;
  bareme: number;
  /** Référence leçon : "module-2/travail-d-une-force" (même classe/matière) */
  lecon?: string;
}

export interface CompositionImport {
  fichier: string;
  slug: string;
  titre: string;
  classe: string;
  matiere: string;
  duree_minutes: number;
  mode_affichage: 'une_par_une' | 'liste';
  publie: boolean;
  questions: QuestionImport[];
}

export interface EpreuveImport {
  fichier: string;
  classe: string;
  matiere: string;
  type: 'sequentielle' | 'composition' | 'blanc' | 'officiel' | 'controle';
  numero_sequence?: number;
  annee: number;
  serie?: string;
  etablissement?: string;
  titre: string;
  /** URL absolue, chemin /public (ex. /epreuves-demo/x.pdf) ou fichier local dans content/epreuves/pdf/ */
  pdf?: string;
  composable: boolean;
  /** slug de la composition liée quand composable */
  composition_slug?: string;
  /** Références leçons "module-2/slug" séparées par ; dans le CSV */
  lecons: string[];
}

export interface ImportError {
  fichier: string;
  message: string;
}

export interface ImportReport {
  crees: number;
  maj: number;
  erreurs: ImportError[];
}
