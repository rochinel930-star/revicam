// Writers du pipeline d'import.
//
// Deux implémentations de la même sémantique d'upsert idempotent :
//  - SupabaseWriter : écrit directement via l'API Supabase (clé service_role).
//  - SqlWriter      : génère un script SQL équivalent (utilisable via l'éditeur
//                     SQL du dashboard quand la clé service n'est pas sous la main).
//
// Clés naturelles (ré-importer ne duplique jamais) :
//  classes(slug) · matieres(slug) · modules(classe, matiere, numero)
//  lecons(module, numero) · compositions(slug) · questions(composition, ordre)
//  epreuves(classe, matiere, type, annee, titre)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import type { StructureImport, LeconImport, CompositionImport, EpreuveImport, ImportError } from './types';

/** ids d'options a, b, c… pour les QCM de composition. */
const OPTION_IDS = 'abcdefghijklmnopqrstuvwxyz';

export interface Writer {
  importStructure(s: StructureImport): Promise<void>;
  importLecon(l: LeconImport): Promise<void>;
  importComposition(c: CompositionImport): Promise<void>;
  importEpreuve(e: EpreuveImport): Promise<void>;
  finish(): Promise<void>;
  crees: number;
  maj: number;
  erreurs: ImportError[];
}

function qcmJson(l: LeconImport) {
  return l.qcm?.map((q) => ({
    enonce_mdx: q.enonce_mdx,
    options: q.options,
    bonnes: q.bonnes,
    explication_mdx: q.explication_mdx ?? null,
  })) ?? null;
}

function exercicesJson(l: LeconImport) {
  return l.exercices?.map((e) => ({
    titre: e.titre,
    enonce_mdx: e.enonce_mdx,
    corrige_mdx: e.corrige_mdx ?? null,
  })) ?? null;
}

// ────────────────────────────────────────────────────────────────────
// SupabaseWriter
// ────────────────────────────────────────────────────────────────────

export class SupabaseWriter implements Writer {
  crees = 0;
  maj = 0;
  erreurs: ImportError[] = [];
  private sb: SupabaseClient;
  private classeIds = new Map<string, string>();
  private matiereIds = new Map<string, string>();
  private moduleIds = new Map<string, string>(); // "classe|matiere|numero" → id
  private leconIds = new Map<string, string>();  // "classe|matiere|module-numero/slug" → id
  private compositionIds = new Map<string, string>(); // slug → id

  constructor(url: string, serviceKey: string, private contentDir: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  private fail(fichier: string, message: string): never {
    this.erreurs.push({ fichier, message });
    throw new Error(message);
  }

  private async classeId(slug: string, fichier: string): Promise<string> {
    if (this.classeIds.has(slug)) return this.classeIds.get(slug)!;
    const { data, error } = await this.sb.from('classes').select('id').eq('slug', slug).maybeSingle();
    if (error) this.fail(fichier, `Lecture classes : ${error.message}`);
    if (!data) this.fail(fichier, `Classe inconnue « ${slug} » — la déclarer dans content/structure.json`);
    this.classeIds.set(slug, data.id);
    return data.id;
  }

  private async matiereId(slug: string, fichier: string): Promise<string> {
    if (this.matiereIds.has(slug)) return this.matiereIds.get(slug)!;
    const { data, error } = await this.sb.from('matieres').select('id').eq('slug', slug).maybeSingle();
    if (error) this.fail(fichier, `Lecture matieres : ${error.message}`);
    if (!data) this.fail(fichier, `Matière inconnue « ${slug} » — la déclarer dans content/structure.json`);
    this.matiereIds.set(slug, data.id);
    return data.id;
  }

  private async moduleId(classe: string, matiere: string, numero: number, fichier: string): Promise<string> {
    const key = `${classe}|${matiere}|${numero}`;
    if (this.moduleIds.has(key)) return this.moduleIds.get(key)!;
    const [cid, mid] = [await this.classeId(classe, fichier), await this.matiereId(matiere, fichier)];
    const { data, error } = await this.sb.from('modules').select('id')
      .eq('classe_id', cid).eq('matiere_id', mid).eq('numero', numero).maybeSingle();
    if (error) this.fail(fichier, `Lecture modules : ${error.message}`);
    if (!data) this.fail(fichier, `Module ${numero} (${classe}/${matiere}) inconnu — le déclarer dans content/structure.json`);
    this.moduleIds.set(key, data.id);
    return data.id;
  }

  /** Résout une référence leçon "module-2/slug" pour une classe/matière données. */
  private async leconId(ref: string, classe: string, matiere: string, fichier: string): Promise<string | null> {
    const m = ref.match(/^module-(\d+)\/(.+)$/);
    if (!m) this.fail(fichier, `Référence leçon invalide « ${ref} » (attendu : module-N/slug)`);
    const key = `${classe}|${matiere}|${ref}`;
    if (this.leconIds.has(key)) return this.leconIds.get(key)!;
    const moduleId = await this.moduleId(classe, matiere, Number(m![1]), fichier);
    const { data, error } = await this.sb.from('lecons').select('id')
      .eq('module_id', moduleId).eq('slug', m![2]).maybeSingle();
    if (error) this.fail(fichier, `Lecture lecons : ${error.message}`);
    if (!data) this.fail(fichier, `Leçon inconnue « ${ref} » (${classe}/${matiere}) — l'importer d'abord`);
    this.leconIds.set(key, data.id);
    return data.id;
  }

  async importStructure(s: StructureImport): Promise<void> {
    const f = 'content/structure.json';
    for (const c of s.classes) {
      const { data } = await this.sb.from('classes').select('id').eq('slug', c.slug).maybeSingle();
      const { error } = await this.sb.from('classes').upsert(
        { slug: c.slug, nom: c.nom, ordre: c.ordre }, { onConflict: 'slug' });
      if (error) this.fail(f, `classes : ${error.message}`);
      if (data) this.maj++; else this.crees++;
    }
    for (const m of s.matieres) {
      const { data } = await this.sb.from('matieres').select('id').eq('slug', m.slug).maybeSingle();
      const { error } = await this.sb.from('matieres').upsert(
        { slug: m.slug, nom: m.nom, couleur_hex: m.couleur, icone: m.icone ?? null }, { onConflict: 'slug' });
      if (error) this.fail(f, `matieres : ${error.message}`);
      if (data) this.maj++; else this.crees++;
    }
    for (const cm of s.classe_matieres) {
      const row = {
        classe_id: await this.classeId(cm.classe, f),
        matiere_id: await this.matiereId(cm.matiere, f),
        coefficient: cm.coefficient ?? null,
      };
      const { error } = await this.sb.from('classe_matieres').upsert(row, { onConflict: 'classe_id,matiere_id' });
      if (error) this.fail(f, `classe_matieres : ${error.message}`);
    }
    for (const mo of s.modules) {
      const row = {
        classe_id: await this.classeId(mo.classe, f),
        matiere_id: await this.matiereId(mo.matiere, f),
        numero: mo.numero,
        titre: mo.titre,
      };
      const { data } = await this.sb.from('modules').select('id')
        .eq('classe_id', row.classe_id).eq('matiere_id', row.matiere_id).eq('numero', row.numero).maybeSingle();
      const { error } = await this.sb.from('modules').upsert(row, { onConflict: 'classe_id,matiere_id,numero' });
      if (error) this.fail(f, `modules : ${error.message}`);
      if (data) this.maj++; else this.crees++;
    }
  }

  async importLecon(l: LeconImport): Promise<void> {
    const moduleId = await this.moduleId(l.classe, l.matiere, l.module, l.fichier);
    const row = {
      module_id: moduleId,
      numero: l.numero,
      titre: l.titre,
      slug: l.slug,
      duree_lecture_min: l.duree ?? null,
      objectifs: l.objectifs,
      contenu_mdx: l.contenu_mdx ?? null,
      essentiel_mdx: l.essentiel_mdx ?? null,
      jeu_bilingue: l.jeu_bilingue ?? null,
      qcm: qcmJson(l),
      exercices: exercicesJson(l),
      publie: l.publie,
    };
    const { data } = await this.sb.from('lecons').select('id').eq('module_id', moduleId).eq('numero', l.numero).maybeSingle();
    const { error } = await this.sb.from('lecons').upsert(row, { onConflict: 'module_id,numero' });
    if (error) this.fail(l.fichier, `Upsert leçon : ${error.message}`);
    if (data) this.maj++; else this.crees++;
  }

  async importComposition(c: CompositionImport): Promise<void> {
    const bareme_total = c.questions.reduce((s, q) => s + q.bareme, 0);
    const row = {
      slug: c.slug,
      titre: c.titre,
      matiere_id: await this.matiereId(c.matiere, c.fichier),
      classe_id: await this.classeId(c.classe, c.fichier),
      duree_minutes: c.duree_minutes,
      bareme_total,
      mode_affichage: c.mode_affichage,
      publie: c.publie,
    };
    const { data: existing } = await this.sb.from('compositions').select('id').eq('slug', c.slug).maybeSingle();
    const { data: comp, error } = await this.sb.from('compositions')
      .upsert(row, { onConflict: 'slug' }).select('id').single();
    if (error || !comp) this.fail(c.fichier, `Upsert composition : ${error?.message}`);
    if (existing) this.maj++; else this.crees++;

    const qRows = [];
    for (let i = 0; i < c.questions.length; i++) {
      const q = c.questions[i];
      qRows.push({
        composition_id: comp.id,
        lecon_id: q.lecon ? await this.leconId(q.lecon, c.classe, c.matiere, c.fichier) : null,
        ordre: i + 1,
        type: q.type,
        enonce_mdx: q.enonce,
        options: q.options ? q.options.map((texte, j) => ({ id: OPTION_IDS[j], texte })) : null,
        bonnes_reponses: q.bonnes_reponses ? q.bonnes_reponses.map((j) => OPTION_IDS[j]) : null,
        corrige_type_mdx: q.corrige_type ?? null,
        bareme: q.bareme,
      });
    }
    const { error: qErr } = await this.sb.from('questions').upsert(qRows, { onConflict: 'composition_id,ordre' });
    if (qErr) this.fail(c.fichier, `Upsert questions : ${qErr.message}`);
    // Retirer les questions au-delà du nouveau nombre (composition raccourcie).
    const { error: dErr } = await this.sb.from('questions')
      .delete().eq('composition_id', comp.id).gt('ordre', c.questions.length);
    if (dErr) this.fail(c.fichier, `Nettoyage questions : ${dErr.message}`);
  }

  async importEpreuve(e: EpreuveImport): Promise<void> {
    // PDF : URL absolue ou chemin /public gardés tels quels ; fichier local → upload Storage.
    let pdf_url: string | null = e.pdf ?? null;
    if (pdf_url && !/^(https?:\/\/|\/)/.test(pdf_url)) {
      const local = path.join(this.contentDir, 'epreuves', 'pdf', pdf_url);
      if (!fs.existsSync(local)) this.fail(e.fichier, `PDF introuvable : ${local}`);
      const dest = `${e.classe}/${e.matiere}/${pdf_url}`;
      const { error: upErr } = await this.sb.storage.from('epreuves')
        .upload(dest, fs.readFileSync(local), { contentType: 'application/pdf', upsert: true });
      if (upErr) this.fail(e.fichier, `Upload PDF : ${upErr.message}`);
      pdf_url = this.sb.storage.from('epreuves').getPublicUrl(dest).data.publicUrl;
    }
    const row = {
      classe_id: await this.classeId(e.classe, e.fichier),
      matiere_id: await this.matiereId(e.matiere, e.fichier),
      type: e.type,
      numero_sequence: e.numero_sequence ?? null,
      annee: e.annee,
      serie: e.serie ?? null,
      etablissement: e.etablissement ?? null,
      titre: e.titre,
      pdf_url,
      composable: e.composable,
    };
    const { data: existing } = await this.sb.from('epreuves').select('id')
      .eq('classe_id', row.classe_id).eq('matiere_id', row.matiere_id)
      .eq('type', row.type).eq('annee', row.annee).eq('titre', row.titre).maybeSingle();
    const { data: ep, error } = await this.sb.from('epreuves')
      .upsert(row, { onConflict: 'classe_id,matiere_id,type,annee,titre' }).select('id').single();
    if (error || !ep) this.fail(e.fichier, `Upsert épreuve : ${error?.message}`);
    if (existing) this.maj++; else this.crees++;

    // Liens épreuve ↔ leçons (remplacés à chaque import).
    await this.sb.from('epreuve_lecons').delete().eq('epreuve_id', ep.id);
    for (const ref of e.lecons) {
      const lid = await this.leconId(ref, e.classe, e.matiere, e.fichier);
      const { error: lErr } = await this.sb.from('epreuve_lecons')
        .upsert({ epreuve_id: ep.id, lecon_id: lid }, { onConflict: 'epreuve_id,lecon_id' });
      if (lErr) this.fail(e.fichier, `Lien leçon : ${lErr.message}`);
    }
    // Pont « Composer cette épreuve » : la composition liée pointe vers l'épreuve.
    if (e.composable && e.composition_slug) {
      const { data: comp, error: cErr } = await this.sb.from('compositions')
        .update({ source_epreuve_id: ep.id }).eq('slug', e.composition_slug).select('id');
      if (cErr) this.fail(e.fichier, `Lien composition : ${cErr.message}`);
      if (!comp || comp.length === 0) {
        this.fail(e.fichier, `composition_slug « ${e.composition_slug} » introuvable — importer la composition d'abord`);
      }
    }
  }

  async finish(): Promise<void> { /* rien à clore */ }
}

// ────────────────────────────────────────────────────────────────────
// SqlWriter — génère le SQL idempotent équivalent
// ────────────────────────────────────────────────────────────────────

export class SqlWriter implements Writer {
  crees = 0;
  maj = 0;
  erreurs: ImportError[] = [];
  private out: string[] = [
    '-- Script généré par `npm run import -- --sql` — idempotent, ré-exécutable.',
    'begin;',
  ];

  constructor(private outFile: string) {}

  /** Littéral SQL sûr via dollar-quoting (tag choisi hors du contenu). */
  private lit(v: string | null | undefined): string {
    if (v === null || v === undefined) return 'null';
    let tag = '$mdx$';
    while (v.includes(tag)) tag = `$mdx${Math.random().toString(36).slice(2, 6)}$`;
    return `${tag}${v}${tag}`;
  }

  private jlit(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    return `${this.lit(JSON.stringify(v))}::jsonb`;
  }

  private num(v: number | null | undefined): string {
    return v === null || v === undefined ? 'null' : String(v);
  }

  private classeRef(slug: string): string {
    return `(select id from classes where slug = ${this.lit(slug)})`;
  }
  private matiereRef(slug: string): string {
    return `(select id from matieres where slug = ${this.lit(slug)})`;
  }
  private moduleRef(classe: string, matiere: string, numero: number): string {
    return `(select id from modules where classe_id = ${this.classeRef(classe)} and matiere_id = ${this.matiereRef(matiere)} and numero = ${numero})`;
  }
  private leconRef(ref: string, classe: string, matiere: string, fichier: string): string {
    const m = ref.match(/^module-(\d+)\/(.+)$/);
    if (!m) {
      this.erreurs.push({ fichier, message: `Référence leçon invalide « ${ref} » (attendu : module-N/slug)` });
      throw new Error('référence leçon invalide');
    }
    return `(select id from lecons where module_id = ${this.moduleRef(classe, matiere, Number(m[1]))} and slug = ${this.lit(m[2])})`;
  }

  async importStructure(s: StructureImport): Promise<void> {
    for (const c of s.classes) {
      this.out.push(
        `insert into classes (slug, nom, ordre) values (${this.lit(c.slug)}, ${this.lit(c.nom)}, ${c.ordre})` +
        ` on conflict (slug) do update set nom = excluded.nom, ordre = excluded.ordre;`
      );
      this.crees++;
    }
    for (const m of s.matieres) {
      this.out.push(
        `insert into matieres (slug, nom, couleur_hex, icone) values (${this.lit(m.slug)}, ${this.lit(m.nom)}, ${this.lit(m.couleur)}, ${this.lit(m.icone ?? null)})` +
        ` on conflict (slug) do update set nom = excluded.nom, couleur_hex = excluded.couleur_hex, icone = excluded.icone;`
      );
      this.crees++;
    }
    for (const cm of s.classe_matieres) {
      this.out.push(
        `insert into classe_matieres (classe_id, matiere_id, coefficient) values (${this.classeRef(cm.classe)}, ${this.matiereRef(cm.matiere)}, ${this.num(cm.coefficient)})` +
        ` on conflict (classe_id, matiere_id) do update set coefficient = excluded.coefficient;`
      );
    }
    for (const mo of s.modules) {
      this.out.push(
        `insert into modules (classe_id, matiere_id, numero, titre) values (${this.classeRef(mo.classe)}, ${this.matiereRef(mo.matiere)}, ${mo.numero}, ${this.lit(mo.titre)})` +
        ` on conflict (classe_id, matiere_id, numero) do update set titre = excluded.titre;`
      );
      this.crees++;
    }
  }

  async importLecon(l: LeconImport): Promise<void> {
    this.out.push(
      `insert into lecons (module_id, numero, titre, slug, duree_lecture_min, objectifs, contenu_mdx, essentiel_mdx, jeu_bilingue, qcm, exercices, publie) values (` +
      `${this.moduleRef(l.classe, l.matiere, l.module)}, ${l.numero}, ${this.lit(l.titre)}, ${this.lit(l.slug)}, ${this.num(l.duree)}, ` +
      `${this.jlit(l.objectifs)}, ${this.lit(l.contenu_mdx ?? null)}, ${this.lit(l.essentiel_mdx ?? null)}, ` +
      `${this.jlit(l.jeu_bilingue ?? null)}, ${this.jlit(qcmJson(l))}, ${this.jlit(exercicesJson(l))}, ${l.publie})` +
      ` on conflict (module_id, numero) do update set titre = excluded.titre, slug = excluded.slug, duree_lecture_min = excluded.duree_lecture_min, ` +
      `objectifs = excluded.objectifs, contenu_mdx = excluded.contenu_mdx, essentiel_mdx = excluded.essentiel_mdx, ` +
      `jeu_bilingue = excluded.jeu_bilingue, qcm = excluded.qcm, exercices = excluded.exercices, publie = excluded.publie;`
    );
    this.crees++;
  }

  async importComposition(c: CompositionImport): Promise<void> {
    const bareme_total = c.questions.reduce((s, q) => s + q.bareme, 0);
    this.out.push(
      `insert into compositions (slug, titre, matiere_id, classe_id, duree_minutes, bareme_total, mode_affichage, publie) values (` +
      `${this.lit(c.slug)}, ${this.lit(c.titre)}, ${this.matiereRef(c.matiere)}, ${this.classeRef(c.classe)}, ` +
      `${c.duree_minutes}, ${bareme_total}, ${this.lit(c.mode_affichage)}, ${c.publie})` +
      ` on conflict (slug) do update set titre = excluded.titre, matiere_id = excluded.matiere_id, classe_id = excluded.classe_id, ` +
      `duree_minutes = excluded.duree_minutes, bareme_total = excluded.bareme_total, mode_affichage = excluded.mode_affichage, publie = excluded.publie;`
    );
    const compRef = `(select id from compositions where slug = ${this.lit(c.slug)})`;
    c.questions.forEach((q, i) => {
      const options = q.options ? q.options.map((texte, j) => ({ id: OPTION_IDS[j], texte })) : null;
      const bonnes = q.bonnes_reponses ? q.bonnes_reponses.map((j) => OPTION_IDS[j]) : null;
      const leconId = q.lecon ? this.leconRef(q.lecon, c.classe, c.matiere, c.fichier) : 'null';
      this.out.push(
        `insert into questions (composition_id, lecon_id, ordre, type, enonce_mdx, options, bonnes_reponses, corrige_type_mdx, bareme) values (` +
        `${compRef}, ${leconId}, ${i + 1}, ${this.lit(q.type)}, ${this.lit(q.enonce)}, ${this.jlit(options)}, ${this.jlit(bonnes)}, ` +
        `${this.lit(q.corrige_type ?? null)}, ${q.bareme})` +
        ` on conflict (composition_id, ordre) do update set lecon_id = excluded.lecon_id, type = excluded.type, enonce_mdx = excluded.enonce_mdx, ` +
        `options = excluded.options, bonnes_reponses = excluded.bonnes_reponses, corrige_type_mdx = excluded.corrige_type_mdx, bareme = excluded.bareme;`
      );
    });
    this.out.push(`delete from questions where composition_id = ${compRef} and ordre > ${c.questions.length};`);
    this.crees++;
  }

  async importEpreuve(e: EpreuveImport): Promise<void> {
    if (e.pdf && !/^(https?:\/\/|\/)/.test(e.pdf)) {
      this.erreurs.push({
        fichier: e.fichier,
        message: `Le mode --sql ne peut pas téléverser le PDF local « ${e.pdf} » — utiliser une URL, un chemin /public, ou l'import direct avec SUPABASE_SERVICE_ROLE_KEY`,
      });
      throw new Error('pdf local en mode sql');
    }
    this.out.push(
      `insert into epreuves (classe_id, matiere_id, type, numero_sequence, annee, serie, etablissement, titre, pdf_url, composable) values (` +
      `${this.classeRef(e.classe)}, ${this.matiereRef(e.matiere)}, ${this.lit(e.type)}, ${this.num(e.numero_sequence)}, ${e.annee}, ` +
      `${this.lit(e.serie ?? null)}, ${this.lit(e.etablissement ?? null)}, ${this.lit(e.titre)}, ${this.lit(e.pdf ?? null)}, ${e.composable})` +
      ` on conflict (classe_id, matiere_id, type, annee, titre) do update set numero_sequence = excluded.numero_sequence, serie = excluded.serie, ` +
      `etablissement = excluded.etablissement, pdf_url = excluded.pdf_url, composable = excluded.composable;`
    );
    const epRef = `(select id from epreuves where classe_id = ${this.classeRef(e.classe)} and matiere_id = ${this.matiereRef(e.matiere)} and type = ${this.lit(e.type)} and annee = ${e.annee} and titre = ${this.lit(e.titre)})`;
    this.out.push(`delete from epreuve_lecons where epreuve_id = ${epRef};`);
    for (const ref of e.lecons) {
      this.out.push(
        `insert into epreuve_lecons (epreuve_id, lecon_id) values (${epRef}, ${this.leconRef(ref, e.classe, e.matiere, e.fichier)})` +
        ` on conflict do nothing;`
      );
    }
    if (e.composable && e.composition_slug) {
      this.out.push(`update compositions set source_epreuve_id = ${epRef} where slug = ${this.lit(e.composition_slug)};`);
    }
    this.crees++;
  }

  async finish(): Promise<void> {
    this.out.push('commit;');
    fs.writeFileSync(this.outFile, this.out.join('\n') + '\n', 'utf8');
  }
}
