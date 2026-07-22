// Types des données publiques (miroir du schéma Supabase).

export interface Classe {
  id: string;
  slug: string;
  nom: string;
  ordre: number;
}

export interface Matiere {
  id: string;
  slug: string;
  nom: string;
  couleur_hex: string;
  icone: string | null;
}

export interface Module {
  id: string;
  matiere_id: string;
  classe_id: string;
  numero: number;
  titre: string;
}

export interface QcmItem {
  enonce_mdx: string;
  options: string[];
  bonnes: number[];
  explication_mdx: string | null;
}

export interface Exercice {
  titre: string;
  enonce_mdx: string;
  corrige_mdx: string | null;
}

export interface Lecon {
  id: string;
  module_id: string;
  numero: number;
  titre: string;
  slug: string;
  duree_lecture_min: number | null;
  objectifs: string[];
  contenu_mdx: string | null;
  essentiel_mdx: string | null;
  jeu_bilingue: { fr: string; en: string }[] | null;
  qcm: QcmItem[] | null;
  exercices: Exercice[] | null;
  publie: boolean;
}

export interface Epreuve {
  id: string;
  classe_id: string;
  matiere_id: string;
  type: 'sequentielle' | 'composition' | 'blanc' | 'officiel' | 'controle';
  numero_sequence: number | null;
  annee: number;
  serie: string | null;
  etablissement: string | null;
  titre: string;
  pdf_url: string | null;
  composable: boolean;
}

export interface Composition {
  id: string;
  slug: string;
  titre: string;
  matiere_id: string;
  classe_id: string;
  source_epreuve_id: string | null;
  duree_minutes: number;
  bareme_total: number;
  mode_affichage: 'une_par_une' | 'liste';
  publie: boolean;
}

/** Question telle que vue par le client : vue questions_public, SANS corrigés. */
export interface QuestionPublique {
  id: string;
  composition_id: string;
  lecon_id: string | null;
  ordre: number;
  type: 'qcm' | 'libre';
  enonce_mdx: string;
  options: { id: string; texte: string }[] | null;
  bareme: number;
}

/** Réponse d'élève : ids d'options pour un qcm, texte pour une libre. */
export type Reponse = { choix: string[] } | { texte: string };

export interface FeedbackIA {
  appreciation: string;
  points_forts: string[];
  points_a_corriger: string[];
}

export interface AttemptAnswerResultat {
  question_id: string;
  reponse: Reponse | null;
  note: number | null;
  feedback_ia: FeedbackIA | null;
}

export interface Attempt {
  id: string;
  composition_id: string;
  statut: 'en_cours' | 'soumise' | 'corrigee' | 'correction_partielle';
  started_at: string;
  submitted_at: string | null;
  note_finale: number | null;
}

export const TYPE_EPREUVE_LABELS: Record<Epreuve['type'], string> = {
  sequentielle: 'Épreuve séquentielle',
  composition: 'Composition trimestrielle',
  blanc: 'Examen blanc',
  officiel: 'Sujet officiel',
  controle: 'Contrôle',
};
