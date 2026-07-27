// Adaptateur LLM — Phase P4.
//
// Découple le pipeline des fournisseurs (Gemini pour l'OCR/extraction bon
// marché, Anthropic pour le jugement premium). Le pipeline ne dépend JAMAIS
// d'un fournisseur concret : il appelle cette interface. Par défaut, un
// adaptateur « Noop » (non disponible) est actif — les étapes déterministes
// fonctionnent sans aucune clé ni appel réseau. Un fournisseur réel s'injecte
// via `enregistrerAdapter()` (fait au démarrage serveur si les clés existent).
//
// Politique de coût IA : OCR/extraction = fournisseur bon marché ; jugement =
// premium ciblé. Toujours mis en cache par hash en amont (dédup).

import type { Artefact } from '@/lib/ingestion/types';

export interface JugementIA {
  score: number;       // 0..1 : adéquation au contenu source (grounding)
  commentaire: string;
}

/** Réponse de génération : contenu structuré + coût observé. */
export interface ReponseGeneration {
  contenu: unknown;
  cout_tokens?: number;
  modele?: string;
}

export interface LlmAdapter {
  nom: string;
  disponible(): boolean;
  /** OCR d'un artefact binaire → texte. */
  ocr?(artefact: Artefact): Promise<string>;
  /** Extraction structurée d'un texte → JSON canonique (non typé ici). */
  extraire?(texte: string, type: string): Promise<unknown>;
  /** Jugement de grounding d'une extraction (premium, ciblé). */
  juger?(source: string, extraction: unknown): Promise<JugementIA>;
  /** Génération d'un artefact pédagogique (modèle bon marché, en batch). */
  generer?(instruction: string, contexte: string): Promise<ReponseGeneration>;
}

/** Adaptateur par défaut : indisponible (aucun appel réseau). */
export const NOOP_ADAPTER: LlmAdapter = {
  nom: 'noop',
  disponible: () => false,
};

let actif: LlmAdapter = NOOP_ADAPTER;

/** Injecte un adaptateur concret (au démarrage serveur, selon les clés). */
export function enregistrerAdapter(adapter: LlmAdapter): void {
  actif = adapter;
}

/** Restaure l'adaptateur par défaut (utile aux tests). */
export function reinitialiserAdapter(): void {
  actif = NOOP_ADAPTER;
}

export function adapterActif(): LlmAdapter {
  return actif;
}
