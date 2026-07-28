// Action de revue en lot — P10.  POST /api/admin/epreuves/valider
//
// { ids: string[], action: 'valider' | 'rejeter' }
//   valider → passe valide=true (l'épreuve devient publique).
//   rejeter → supprime la ligne (import non retenu ; le PDF reste en Storage).
// Jeton d'administration requis (service_role).

import { NextResponse } from 'next/server';
import { verifierAdmin } from '@/lib/admin-auth';
import { sbAdmin } from '@/lib/supabase';
import { logger } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const verdict = verifierAdmin(req);
  if (!verdict.ok) return NextResponse.json({ error: verdict.raison }, { status: verdict.statut });

  const log = logger();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  const action = body.action;
  if (ids.length === 0) return NextResponse.json({ error: 'Aucun id fourni' }, { status: 400 });
  if (action !== 'valider' && action !== 'rejeter') {
    return NextResponse.json({ error: "action doit être 'valider' ou 'rejeter'" }, { status: 400 });
  }

  const sb = sbAdmin();
  if (action === 'valider') {
    const { error } = await sb.from('epreuves').update({ valide: true }).in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from('epreuves').delete().in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  log.info('revue_epreuves', { action, n: ids.length });
  return NextResponse.json(
    { ok: true, action, traites: ids.length },
    { headers: { 'x-request-id': log.requestId } }
  );
}
