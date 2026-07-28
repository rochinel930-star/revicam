// Liste des épreuves à valider — revue en lot (P10).  GET /api/admin/epreuves
//
// Renvoie les épreuves importées non encore validées (valide=false), avec leur
// classification, pour revue humaine en masse. Jeton d'administration requis
// (service_role, contourne la RLS). Pagination via limit/offset.

import { NextResponse } from 'next/server';
import { verifierAdmin } from '@/lib/admin-auth';
import { sbAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CHAMPS =
  'id, titre, titre_harmonise, type, type_document, numero_sequence, annee, annee_session, serie, ' +
  'etablissement, nombre_pages, contient_corrige, est_apc, mots_cles, url_thumbnail, pdf_url, created_at, ' +
  'classes(nom, slug), matieres(nom, slug)';

export async function GET(req: Request) {
  const verdict = verifierAdmin(req);
  if (!verdict.ok) return NextResponse.json({ error: verdict.raison }, { status: verdict.statut });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const valide = url.searchParams.get('valide') === 'true';

  const sb = sbAdmin();
  const { data, error, count } = await sb
    .from('epreuves')
    .select(CHAMPS, { count: 'exact' })
    .eq('valide', valide)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ epreuves: data ?? [], total: count ?? 0, limit, offset });
}
