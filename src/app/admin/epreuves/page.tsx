'use client';

// Revue en lot des épreuves importées — P10.
//
// Accès par jeton d'administration (ADMIN_API_TOKEN), sans compte : le jeton
// est saisi une fois et conservé en sessionStorage (effacé à la fermeture).
// Liste les imports non validés (valide=false) → validation/rejet en masse.

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useMounted } from '@/lib/use-mounted';
import { TYPE_EPREUVE_LABELS, type TypeEpreuve } from '@/lib/types';

interface Ep {
  id: string;
  titre: string;
  titre_harmonise: string | null;
  type: TypeEpreuve;
  type_document: string | null;
  numero_sequence: number | null;
  annee: number | null;
  annee_session: string | null;
  serie: string | null;
  etablissement: string | null;
  nombre_pages: number | null;
  contient_corrige: boolean | null;
  url_thumbnail: string | null;
  pdf_url: string | null;
  classes: { nom: string } | null;
  matieres: { nom: string } | null;
}

const PAGE = 50;

export default function PageRevueEpreuves() {
  const mounted = useMounted();
  const stored = mounted ? sessionStorage.getItem('revicam.admin') ?? '' : '';
  const [tokenSaisi, setTokenSaisi] = useState('');
  const token = tokenSaisi || stored;

  const [onglet, setOnglet] = useState<'attente' | 'valide'>('attente');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ epreuves: Ep[]; total: number } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!token) return null;
    const res = await fetch(
      `/api/admin/epreuves?valide=${onglet === 'valide'}&limit=${PAGE}&offset=${offset}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const j = await res.json();
    return res.ok ? { data: j } : { erreur: j.error as string };
  }, [token, onglet, offset]);

  useEffect(() => {
    let annule = false;
    charger().then((r) => {
      if (annule || !r) return;
      if (r.erreur) setErreur(r.erreur);
      else {
        setErreur(null);
        setData(r.data);
        setSel(new Set());
      }
    });
    return () => {
      annule = true;
    };
  }, [charger]);

  function connecter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get('token');
    if (typeof v === 'string' && v.trim()) {
      sessionStorage.setItem('revicam.admin', v.trim());
      setTokenSaisi(v.trim());
    }
  }

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toutSelectionner() {
    setSel((prev) => (prev.size === (data?.epreuves.length ?? 0) ? new Set() : new Set(data?.epreuves.map((e) => e.id))));
  }

  async function agir(action: 'valider' | 'rejeter') {
    if (sel.size === 0) return;
    setBusy(true);
    await fetch('/api/admin/epreuves/valider', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: [...sel], action }),
    });
    const r = await charger();
    if (r && !r.erreur) {
      setData(r.data);
      setSel(new Set());
    }
    setBusy(false);
  }

  function nomEp(e: Ep): string {
    const meta = [
      e.matieres?.nom,
      e.classes?.nom,
      e.type ? TYPE_EPREUVE_LABELS[e.type] : null,
      e.numero_sequence ? `N°${e.numero_sequence}` : null,
      e.serie ? `Série ${e.serie}` : null,
      e.annee_session ?? e.annee,
      e.etablissement,
    ]
      .filter(Boolean)
      .join(' · ');
    return e.titre_harmonise || e.titre || meta;
  }

  // ── Écran de connexion ────────────────────────────────────────────
  if (!token) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <Card>
          <h1 className="text-xl font-bold text-navy">🗂️ Revue des épreuves</h1>
          <p className="mt-2 text-sm text-slate-600">
            Accès réservé. Saisis le jeton d’administration (variable <code>ADMIN_API_TOKEN</code>).
          </p>
          <form onSubmit={connecter} className="mt-4 space-y-3">
            <input
              name="token"
              type="password"
              autoComplete="off"
              placeholder="Jeton d’administration"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
            />
            <Button type="submit" className="w-full">Accéder</Button>
          </form>
        </Card>
      </div>
    );
  }

  const eps = data?.epreuves ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-navy">🗂️ Revue des épreuves</h1>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem('revicam.admin');
            setTokenSaisi(' '); // force re-render vers l'écran de connexion
            location.reload();
          }}
          className="text-xs text-slate-500 underline"
        >
          Se déconnecter
        </button>
      </div>

      {/* Onglets */}
      <div className="mt-3 flex gap-2">
        {(['attente', 'valide'] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => {
              setOnglet(o);
              setOffset(0);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              onglet === o ? 'bg-navy text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {o === 'attente' ? 'À valider' : 'Validées'}
          </button>
        ))}
        <span className="self-center text-xs text-slate-500">{total} au total</span>
      </div>

      {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

      {/* Actions en lot */}
      {onglet === 'attente' && eps.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variante="secondaire" onClick={toutSelectionner}>
            {sel.size === eps.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </Button>
          <Button onClick={() => agir('valider')} disabled={busy || sel.size === 0}>
            ✅ Valider ({sel.size})
          </Button>
          <Button variante="secondaire" onClick={() => agir('rejeter')} disabled={busy || sel.size === 0}>
            🗑 Rejeter ({sel.size})
          </Button>
        </div>
      )}

      {/* Liste */}
      <ul className="mt-3 space-y-2">
        {eps.map((e) => (
          <li key={e.id}>
            <Card className="flex items-start gap-3">
              {onglet === 'attente' && (
                <input
                  type="checkbox"
                  checked={sel.has(e.id)}
                  onChange={() => toggle(e.id)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
              )}
              {e.url_thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.url_thumbnail} alt="" className="h-16 w-12 shrink-0 rounded border object-cover" />
              ) : (
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded border bg-slate-50 text-xs text-slate-400">
                  PDF
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{nomEp(e)}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {e.type_document ?? '—'}
                  {e.contient_corrige ? ' · avec corrigé' : ''}
                  {e.nombre_pages ? ` · ${e.nombre_pages} p.` : ''}
                </p>
                {e.pdf_url && (
                  <a href={e.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-navy underline">
                    Ouvrir le PDF →
                  </a>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {eps.length === 0 && !erreur && (
        <Card className="mt-4 text-center text-sm text-slate-500">
          {onglet === 'attente' ? 'Aucune épreuve en attente de validation.' : 'Aucune épreuve validée.'}
        </Card>
      )}

      {/* Pagination */}
      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Button variante="secondaire" onClick={() => setOffset((o) => Math.max(0, o - PAGE))} disabled={offset === 0}>
            ← Précédent
          </Button>
          <span className="text-xs text-slate-500">
            {offset + 1}–{Math.min(offset + PAGE, total)} / {total}
          </span>
          <Button variante="secondaire" onClick={() => setOffset((o) => o + PAGE)} disabled={offset + PAGE >= total}>
            Suivant →
          </Button>
        </div>
      )}
    </div>
  );
}
