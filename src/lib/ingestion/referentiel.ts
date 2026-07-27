// Chargement du référentiel de validation depuis la base. Phase P4.

import type { SupabaseClient } from '@supabase/supabase-js';
import { TYPE_EPREUVE_LABELS } from '@/lib/types';
import type { Referentiel } from './types';

/** Construit le référentiel (classes/matières connues + types autorisés). */
export async function chargerReferentiel(sb: SupabaseClient): Promise<Referentiel> {
  const [{ data: classes }, { data: matieres }] = await Promise.all([
    sb.from('classes').select('slug'),
    sb.from('matieres').select('slug'),
  ]);
  return {
    classes: (classes ?? []).map((c) => c.slug as string),
    matieres: (matieres ?? []).map((m) => m.slug as string),
    types: Object.keys(TYPE_EPREUVE_LABELS),
  };
}
