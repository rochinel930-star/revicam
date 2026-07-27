// Ingestion en masse d'épreuves — classification économique (P10).
//
//   npm run ingest:epreuves -- <dossier>
//
// Pour chaque fichier (PDF/PNG/JPG) : lit UNIQUEMENT l'en-tête, classe par
// HEURISTIQUE DÉTERMINISTE (gratuit) ; ne sollicite l'IA (Gemini bon marché,
// texte ou vision) QUE si la confiance est insuffisante. Mode RAPPORT (dry-run)
// par défaut : n'écrit rien, affiche la classification + le nom généré, pour
// valider la précision avant d'activer l'écriture.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { readdirSync, readFileSync } from 'node:fs';
import { extname, basename, join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { classifierEntete, type Classification } from '../src/lib/ingestion/classify-epreuve';
import {
  classifierEnteteIA,
  classifierDocumentIA,
  fusionner,
  versClassification,
} from '../src/lib/ingestion/classify-epreuve-ia';
import { adapterActif, enregistrerAdapter } from '../src/lib/ai/adapter';
import { creerGeminiAdapter } from '../src/lib/ai/adapters/gemini';

const SEUIL_CONFIANCE = 0.7;
const EXT_IMAGE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function entetePdf(buf: Buffer): Promise<string | null> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const res = await parser.getText();
    await parser.destroy();
    const t = (res.text ?? '').trim();
    return t.length > 10 ? t.slice(0, 1500) : null;
  } catch {
    return null; // scanné / illisible → vision
  }
}

async function classer(fichier: string, buf: Buffer): Promise<Classification> {
  const ext = extname(fichier).toLowerCase();
  const nom = basename(fichier);
  let header = '';
  let base64: string | null = null;
  let mime: string | null = null;

  if (ext === '.pdf') {
    header = (await entetePdf(buf)) ?? '';
    if (!header) {
      base64 = buf.toString('base64');
      mime = 'application/pdf';
    }
  } else if (EXT_IMAGE[ext]) {
    base64 = buf.toString('base64');
    mime = EXT_IMAGE[ext];
  }

  const heur = classifierEntete(header, nom);
  if (heur.confiance >= SEUIL_CONFIANCE || !adapterActif().disponible()) return heur;

  try {
    const ia = header
      ? await classifierEnteteIA(header)
      : base64 && mime
        ? await classifierDocumentIA(base64, mime)
        : heur.champs;
    return versClassification(fusionner(heur.champs, ia), 'fusion');
  } catch {
    return heur;
  }
}

async function main() {
  const dossier = process.argv[2];
  if (!dossier) {
    console.error('Usage : npm run ingest:epreuves -- <dossier>');
    process.exit(1);
  }
  if (process.env.GEMINI_API_KEY) enregistrerAdapter(creerGeminiAdapter());
  console.log(`Adaptateur IA : ${adapterActif().disponible() ? 'gemini (secours)' : 'aucun (heuristique seule)'}`);
  console.log('Mode : RAPPORT (dry-run) — aucune écriture.\n');

  const fichiers = readdirSync(dossier).filter((f) => ['.pdf', ...Object.keys(EXT_IMAGE)].includes(extname(f).toLowerCase()));
  let gratuit = 0;
  let parIa = 0;
  let aRevoir = 0;

  for (const f of fichiers) {
    const c = await classer(f, readFileSync(join(dossier, f)));
    if (c.source === 'heuristique') gratuit++;
    else parIa++;
    if (c.confiance < SEUIL_CONFIANCE) aRevoir++;
    const flag = c.confiance < SEUIL_CONFIANCE ? '⚠ REVUE' : '✓';
    console.log(`${flag} ${f}`);
    console.log(`    → ${c.titre}`);
    console.log(`    conf=${c.confiance.toFixed(2)} src=${c.source}${c.manquants.length ? ' manque=' + c.manquants.join(',') : ''}`);
  }

  console.log(`\n${fichiers.length} fichier(s) : ${gratuit} classés GRATUITEMENT (heuristique), ${parIa} via IA, ${aRevoir} à revoir.`);
  console.log('Écriture (upload Storage + insertion epreuves) : à activer après validation de la précision.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
