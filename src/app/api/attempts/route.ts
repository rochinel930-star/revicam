// POST /api/attempts — créer une tentative de composition (anonyme via anon_id).
import { NextResponse } from 'next/server';
import { sbAdmin } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let body: { composition_id?: string; anon_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const { composition_id, anon_id } = body;
  if (!composition_id || !UUID_RE.test(composition_id) || !anon_id || !UUID_RE.test(anon_id)) {
    return NextResponse.json({ error: 'composition_id et anon_id (UUID) requis' }, { status: 400 });
  }

  const sb = sbAdmin();
  const { data: compo } = await sb
    .from('compositions')
    .select('id, publie, duree_minutes')
    .eq('id', composition_id)
    .maybeSingle();
  if (!compo || !compo.publie) {
    return NextResponse.json({ error: 'Composition introuvable' }, { status: 404 });
  }

  const { data: attempt, error } = await sb
    .from('attempts')
    .insert({ composition_id, anon_id, statut: 'en_cours' })
    .select('id, started_at')
    .single();
  if (error || !attempt) {
    return NextResponse.json({ error: 'Création impossible' }, { status: 500 });
  }
  return NextResponse.json({
    attempt_id: attempt.id,
    started_at: attempt.started_at,
    duree_minutes: compo.duree_minutes,
  });
}
