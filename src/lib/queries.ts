// Requêtes de lecture publique (SSG/ISR/SSR) via la clé anon.

import { sbPublic } from './supabase';
import type { Classe, Matiere, Module, Lecon, Epreuve, Composition, QuestionPublique } from './types';

export async function getClasses(): Promise<Classe[]> {
  const { data, error } = await sbPublic().from('classes').select('*').order('ordre');
  if (error) throw error;
  return data;
}

export async function getClasse(slug: string): Promise<Classe | null> {
  const { data } = await sbPublic().from('classes').select('*').eq('slug', slug).maybeSingle();
  return data;
}

export async function getMatieres(): Promise<Matiere[]> {
  const { data, error } = await sbPublic().from('matieres').select('*').order('nom');
  if (error) throw error;
  return data;
}

export async function getMatiere(slug: string): Promise<Matiere | null> {
  const { data } = await sbPublic().from('matieres').select('*').eq('slug', slug).maybeSingle();
  return data;
}

export async function getMatieresDeClasse(classeId: string): Promise<Matiere[]> {
  const { data, error } = await sbPublic()
    .from('classe_matieres')
    .select('matieres(*)')
    .eq('classe_id', classeId);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.matieres as unknown as Matiere)
    .filter(Boolean)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export async function getModules(classeId: string, matiereId: string): Promise<Module[]> {
  const { data, error } = await sbPublic()
    .from('modules')
    .select('*')
    .eq('classe_id', classeId)
    .eq('matiere_id', matiereId)
    .order('numero');
  if (error) throw error;
  return data;
}

/** Toutes les leçons d'une liste de modules (métadonnées seulement). */
export async function getLeconsDesModules(moduleIds: string[]): Promise<Lecon[]> {
  if (moduleIds.length === 0) return [];
  const { data, error } = await sbPublic()
    .from('lecons')
    .select('id, module_id, numero, titre, slug, duree_lecture_min, objectifs, publie')
    .in('module_id', moduleIds)
    .order('numero');
  if (error) throw error;
  return data as unknown as Lecon[];
}

export async function getLecon(moduleId: string, slug: string): Promise<Lecon | null> {
  const { data } = await sbPublic()
    .from('lecons')
    .select('*')
    .eq('module_id', moduleId)
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export interface EpreuveAvecRefs extends Epreuve {
  classes: { slug: string; nom: string } | null;
  matieres: { slug: string; nom: string; couleur_hex: string } | null;
}

export interface FiltresEpreuves {
  classe?: string;
  matiere?: string;
  type?: string;
  annee?: number;
  serie?: string;
  etablissement?: string;
}

export async function getEpreuves(filtres: FiltresEpreuves): Promise<EpreuveAvecRefs[]> {
  let q = sbPublic()
    .from('epreuves')
    .select('*, classes!inner(slug, nom), matieres!inner(slug, nom, couleur_hex)')
    .order('annee', { ascending: false })
    .order('titre');
  if (filtres.classe) q = q.eq('classes.slug', filtres.classe);
  if (filtres.matiere) q = q.eq('matieres.slug', filtres.matiere);
  if (filtres.type) q = q.eq('type', filtres.type);
  if (filtres.annee) q = q.eq('annee', filtres.annee);
  if (filtres.serie) q = q.eq('serie', filtres.serie);
  if (filtres.etablissement) q = q.ilike('etablissement', `%${filtres.etablissement}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as EpreuveAvecRefs[];
}

/** Composition liée à une épreuve composable (pont Pilier 1 → Pilier 3). */
export async function getCompositionDeLEpreuve(epreuveId: string): Promise<Composition | null> {
  const { data } = await sbPublic()
    .from('compositions')
    .select('*')
    .eq('source_epreuve_id', epreuveId)
    .eq('publie', true)
    .maybeSingle();
  return data;
}

export interface CompositionAvecRefs extends Composition {
  classes: { slug: string; nom: string } | null;
  matieres: { slug: string; nom: string; couleur_hex: string } | null;
}

export async function getCompositions(): Promise<CompositionAvecRefs[]> {
  const { data, error } = await sbPublic()
    .from('compositions')
    .select('*, classes(slug, nom), matieres(slug, nom, couleur_hex)')
    .eq('publie', true)
    .order('titre');
  if (error) throw error;
  return data as unknown as CompositionAvecRefs[];
}

export async function getComposition(id: string): Promise<CompositionAvecRefs | null> {
  const { data } = await sbPublic()
    .from('compositions')
    .select('*, classes(slug, nom), matieres(slug, nom, couleur_hex)')
    .eq('id', id)
    .maybeSingle();
  return data as unknown as CompositionAvecRefs | null;
}

/** Questions d'une composition, via la VUE PUBLIQUE (jamais les corrigés). */
export async function getQuestionsPubliques(compositionId: string): Promise<QuestionPublique[]> {
  const { data, error } = await sbPublic()
    .from('questions_public')
    .select('*')
    .eq('composition_id', compositionId)
    .order('ordre');
  if (error) throw error;
  return data;
}

/** Compositions publiées comportant au moins une question sur cette leçon. */
export async function getCompositionsDeLaLecon(leconId: string): Promise<Composition[]> {
  const { data, error } = await sbPublic()
    .from('questions_public')
    .select('composition_id')
    .eq('lecon_id', leconId);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((r) => r.composition_id))];
  if (ids.length === 0) return [];
  const { data: compos, error: e2 } = await sbPublic()
    .from('compositions')
    .select('*')
    .in('id', ids)
    .eq('publie', true)
    .order('titre');
  if (e2) throw e2;
  return compos;
}

/** Épreuves du catalogue liées à une leçon (« Sujets liés »). */
export async function getEpreuvesDeLaLecon(leconId: string): Promise<EpreuveAvecRefs[]> {
  const { data, error } = await sbPublic()
    .from('epreuve_lecons')
    .select('epreuves(*, classes(slug, nom), matieres(slug, nom, couleur_hex))')
    .eq('lecon_id', leconId);
  if (error) throw error;
  return (data ?? []).map((r) => r.epreuves as unknown as EpreuveAvecRefs).filter(Boolean);
}
