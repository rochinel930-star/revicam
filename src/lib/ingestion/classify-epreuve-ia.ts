// Secours IA de classification d'en-tête — appelé UNIQUEMENT si l'heuristique
// déterministe n'est pas assez confiante (économie maximale). Texte (en-tête
// extrait) ou vision (document scanné). Palier bon marché (CHAINE_ECO).

import { appelJsonGemini, appelVisionJsonGemini } from '@/lib/ai/adapters/gemini';
import { CHAINE_ECO } from '@/lib/ai/gemini-models';
import { construireTitre, type ChampsEpreuve, type Classification } from './classify-epreuve';
import type { TypeEpreuve } from '@/lib/types';

const INSTRUCTION = `Tu classes une ÉPREUVE du secondaire général camerounais à partir de son EN-TÊTE UNIQUEMENT (ne lis pas l'épreuve entière). Renvoie STRICTEMENT ce JSON :
{"matiere": slug|null (mathematiques,physique,chimie,svt,francais,anglais,philosophie,histoire,geographie,informatique,ecm,economie),
 "niveau": null|sixieme|cinquieme|quatrieme|troisieme|seconde|premiere|terminale,
 "serie": null|"A"|"B"|"C"|"D"|"E"|"TI",
 "type": null|sequentielle|composition|blanc|controle|bepc|probatoire|baccalaureat|cep,
 "numero_sequence": number|null, "trimestre": number|null, "annee": number|null,
 "etablissement": string|null, "session": null|"normale"|"rattrapage"}
Dès que le minimum (matière + niveau + type) est identifié, arrête-toi.`;

const NIVEAUX = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme', 'seconde', 'premiere', 'terminale'];
const TYPES: TypeEpreuve[] = ['sequentielle', 'composition', 'blanc', 'officiel', 'controle', 'bepc', 'probatoire', 'baccalaureat', 'cep'];

function coercer(brut: unknown): ChampsEpreuve {
  const o = (brut ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  const niveau = s(o.niveau);
  const type = s(o.type);
  return {
    matiere: s(o.matiere),
    niveau: niveau && NIVEAUX.includes(niveau) ? niveau : null,
    serie: s(o.serie),
    type: type && (TYPES as string[]).includes(type) ? (type as TypeEpreuve) : null,
    numero_sequence: n(o.numero_sequence),
    trimestre: n(o.trimestre),
    annee: n(o.annee),
    etablissement: s(o.etablissement),
    session: s(o.session) === 'rattrapage' ? 'rattrapage' : s(o.session) === 'normale' ? 'normale' : null,
  };
}

/** Complète les champs manquants d'une classification heuristique par l'IA. */
export function fusionner(base: ChampsEpreuve, ia: ChampsEpreuve): ChampsEpreuve {
  const c: ChampsEpreuve = { ...base };
  (Object.keys(c) as Array<keyof ChampsEpreuve>).forEach((k) => {
    if (c[k] === null && ia[k] !== null) (c[k] as unknown) = ia[k];
  });
  return c;
}

/** Classification IA depuis l'en-tête TEXTE (extrait d'un PDF avec couche texte). */
export async function classifierEnteteIA(entete: string): Promise<ChampsEpreuve> {
  const rep = await appelJsonGemini(`${INSTRUCTION}\n\nEN-TÊTE:\n${entete.slice(0, 1200)}`, CHAINE_ECO, 0.1);
  return coercer(rep.contenu);
}

/** Classification IA par VISION (document scanné / image d'en-tête). */
export async function classifierDocumentIA(base64: string, mimeType: string): Promise<ChampsEpreuve> {
  const rep = await appelVisionJsonGemini(base64, mimeType, INSTRUCTION, CHAINE_ECO, 0.1);
  return coercer(rep.contenu);
}

function confianceDe(c: ChampsEpreuve): number {
  return (c.matiere ? 0.4 : 0) + (c.niveau ? 0.3 : 0) + (c.type ? 0.3 : 0);
}

/** Reconstruit une Classification complète à partir de champs (IA/fusion). */
export function versClassification(c: ChampsEpreuve, source: 'ia' | 'fusion'): Classification {
  const manquants: string[] = [];
  if (!c.matiere) manquants.push('matiere');
  if (!c.niveau) manquants.push('niveau');
  if (!c.type) manquants.push('type');
  return { champs: c, confiance: Math.min(1, confianceDe(c)), titre: construireTitre(c), manquants, source };
}
