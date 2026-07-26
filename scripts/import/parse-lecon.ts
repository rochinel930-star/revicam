// Parseur du gabarit leçon .mdx (voir /content/README.md).
import matter from 'gray-matter';
import type { LeconImport, QcmItem, Exercice, ImportError } from './types';

/** Découpe le corps en sections `## Nom` connues. */
function splitSections(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /^##\s+(Cours|Essentiel|JeuBilingue|QCM|Exercices)\s*$/gm;
  const marks: { name: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    marks.push({ name: m[1], start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < marks.length; i++) {
    const content = body.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : undefined);
    map.set(marks[i].name, content.trim());
  }
  return map;
}

/** Parse le tableau markdown FR ↔ EN du jeu bilingue. */
function parseJeuBilingue(section: string): { fr: string; en: string }[] {
  const pairs: { fr: string; en: string }[] = [];
  for (const line of section.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    // Sauter l'en-tête et la ligne de séparation |---|---|
    if (/^-+$/.test(cells[0].replace(/[: ]/g, '-'))) continue;
    if (/^(français|francais|fr)$/i.test(cells[0])) continue;
    pairs.push({ fr: cells[0], en: cells[1] });
  }
  return pairs;
}

/** Parse les questions QCM : blocs `### Q...` avec cases `- [x]` / `- [ ]`. */
function parseQcm(section: string, fichier: string, errors: ImportError[]): QcmItem[] {
  const items: QcmItem[] = [];
  const blocks = section.split(/^###\s+/m).filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const lines = block.split('\n');
    // La 1re ligne est l'intitulé du bloc (ex. "Q1") — ignorée.
    const enonceLines: string[] = [];
    const options: string[] = [];
    const bonnes: number[] = [];
    const explicationLines: string[] = [];
    for (const line of lines.slice(1)) {
      const opt = line.match(/^- \[([ xX])\]\s+(.*)$/);
      if (opt) {
        if (opt[1].toLowerCase() === 'x') bonnes.push(options.length);
        options.push(opt[2].trim());
      } else if (line.startsWith('>')) {
        explicationLines.push(line.replace(/^>\s?/, '').replace(/^Explication\s*:\s*/i, ''));
      } else if (options.length === 0) {
        enonceLines.push(line);
      }
    }
    const enonce = enonceLines.join('\n').trim();
    if (!enonce || options.length < 2) {
      errors.push({ fichier, message: `QCM : question sans énoncé ou avec moins de 2 options (bloc « ${block.slice(0, 40)}… »)` });
      continue;
    }
    if (bonnes.length === 0) {
      errors.push({ fichier, message: `QCM : aucune bonne réponse cochée [x] pour « ${enonce.slice(0, 60)}… »` });
      continue;
    }
    items.push({
      enonce_mdx: enonce,
      options,
      bonnes,
      explication_mdx: explicationLines.join('\n').trim() || undefined,
    });
  }
  return items;
}

/** Parse les exercices : blocs `### Exercice N — Titre` avec sous-section `#### Corrigé`. */
function parseExercices(section: string): Exercice[] {
  const exos: Exercice[] = [];
  const blocks = section.split(/^###\s+/m).filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    const titre = (nl === -1 ? block : block.slice(0, nl)).trim();
    const rest = nl === -1 ? '' : block.slice(nl + 1);
    const corrigeSplit = rest.split(/^####\s+Corrig[ée]\s*$/m);
    exos.push({
      titre,
      enonce_mdx: corrigeSplit[0].trim(),
      corrige_mdx: corrigeSplit[1]?.trim() || undefined,
    });
  }
  return exos;
}

export function parseLecon(raw: string, fichier: string, errors: ImportError[]): LeconImport | null {
  let fm: matter.GrayMatterFile<string>;
  try {
    fm = matter(raw);
  } catch (e) {
    errors.push({ fichier, message: `Frontmatter YAML invalide : ${(e as Error).message}` });
    return null;
  }
  const d = fm.data as Record<string, unknown>;
  const missing = ['classe', 'matiere', 'module', 'numero', 'titre', 'slug'].filter((k) => d[k] === undefined || d[k] === '');
  if (missing.length > 0) {
    errors.push({ fichier, message: `Champs frontmatter manquants : ${missing.join(', ')}` });
    return null;
  }
  const sections = splitSections(fm.content);
  const before = errors.length;
  const qcm = sections.has('QCM') ? parseQcm(sections.get('QCM')!, fichier, errors) : undefined;
  const lecon: LeconImport = {
    fichier,
    classe: String(d.classe),
    matiere: String(d.matiere),
    module: Number(d.module),
    numero: Number(d.numero),
    titre: String(d.titre),
    slug: String(d.slug),
    duree: d.duree !== undefined ? Number(d.duree) : undefined,
    publie: d.publie === true,
    objectifs: Array.isArray(d.objectifs) ? d.objectifs.map(String) : [],
    contenu_mdx: sections.get('Cours'),
    essentiel_mdx: sections.get('Essentiel'),
    jeu_bilingue: sections.has('JeuBilingue') ? parseJeuBilingue(sections.get('JeuBilingue')!) : undefined,
    qcm,
    exercices: sections.has('Exercices') ? parseExercices(sections.get('Exercices')!) : undefined,
  };
  if (!Number.isInteger(lecon.module) || !Number.isInteger(lecon.numero)) {
    errors.push({ fichier, message: `« module » et « numero » doivent être des entiers` });
    return null;
  }
  if (lecon.publie && !lecon.contenu_mdx) {
    errors.push({ fichier, message: `Leçon marquée publie: true mais sans section « ## Cours »` });
    return null;
  }
  return errors.length > before ? null : lecon;
}
