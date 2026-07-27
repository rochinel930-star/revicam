// Repository du graphe de connaissances — Phase P3.
//
// Lectures publiques (clé anon) des notions/compétences et de la chaîne de
// traversée. Alimente l'analytics, la remédiation et la composition par
// objectif (phases consommatrices P8/P11/P12). Ne lit que des tables/vues
// publiques (jamais question_notion, qui est secret).

import { sbPublic } from './supabase';
import type { Notion, Competence, ChaineNotion } from './types';

/** Notions rattachées à une leçon. */
export async function getNotionsDeLecon(leconId: string): Promise<Notion[]> {
  const { data, error } = await sbPublic()
    .from('lecon_notion')
    .select('notion:notion(*)')
    .eq('lecon_id', leconId);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.notion as unknown as Notion)
    .filter(Boolean);
}

/** Compétences couvertes par une leçon (leçon → notion → compétence). */
export async function getCompetencesDeLecon(leconId: string): Promise<Competence[]> {
  const notions = await getNotionsDeLecon(leconId);
  const ids = notions.map((n) => n.id);
  if (ids.length === 0) return [];
  const { data, error } = await sbPublic()
    .from('notion_competence')
    .select('competence:competence(*)')
    .in('notion_id', ids);
  if (error) throw error;
  const uniques = new Map<string, Competence>();
  for (const r of data ?? []) {
    const c = r.competence as unknown as Competence;
    if (c) uniques.set(c.id, c);
  }
  return [...uniques.values()];
}

/** Chaîne de traversée d'une notion : notion → chapitre → classe → programme → pays. */
export async function getChaineNotion(notionId: string): Promise<ChaineNotion | null> {
  const { data, error } = await sbPublic()
    .from('v_notion_chaine')
    .select('*')
    .eq('notion_id', notionId)
    .maybeSingle();
  if (error) throw error;
  return (data as ChaineNotion | null) ?? null;
}
