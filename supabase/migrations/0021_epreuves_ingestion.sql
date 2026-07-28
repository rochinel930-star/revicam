-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0021 : ingestion documentaire massive (épreuves)
-- ═══════════════════════════════════════════════════════════════════
-- Étend la table `epreuves` EXISTANTE (relationnelle : classe_id/matiere_id
-- FK) pour le pipeline d'importation en masse (Telegram → Gemini → catalogue).
-- On NE recrée PAS la table : additif uniquement, zéro régression sur le
-- catalogue live + la navigation classe-first.
--
-- Ajoute : dédup (hash_md5), titre harmonisé + recherche floue (pg_trgm),
-- nature du document, métadonnées pédagogiques (APC, corrigé…), mots-clés,
-- média (miniature), scoring, et une GARDE DE REVUE (valide) pour que les
-- imports non revus n'apparaissent pas au public tant qu'ils ne sont pas validés.

create extension if not exists pg_trgm;

alter table public.epreuves
  add column if not exists hash_md5                    varchar(32) unique,
  add column if not exists titre_harmonise             text,
  add column if not exists nom_original                text,
  add column if not exists type_document               text,   -- Epreuve|Corrige|Recueil|Fascicule|Manuel
  add column if not exists enseignement                text default 'general',
  add column if not exists niveau_cycle                text,
  add column if not exists annee_session               text,   -- « 2015-2025 » (recueils)
  add column if not exists est_apc                     boolean default false,
  add column if not exists contient_situation_probleme boolean default false,
  add column if not exists contient_corrige            boolean default false,
  add column if not exists mots_cles                   text[] default '{}',
  add column if not exists nombre_pages                int,
  add column if not exists taille_fichier_mo           numeric(6,2),
  add column if not exists url_thumbnail               text,
  add column if not exists score_pertinence            int default 0,
  add column if not exists nombre_telechargements      int default 0,
  add column if not exists valide                      boolean not null default false,
  add column if not exists created_at                  timestamptz not null default now();

-- Recherche floue tolérante aux fautes (titre + établissement).
create index if not exists idx_epreuves_fuzzy_titre
  on public.epreuves using gin (titre_harmonise gin_trgm_ops);
create index if not exists idx_epreuves_fuzzy_etablissement
  on public.epreuves using gin (etablissement gin_trgm_ops);

-- ── Garde de revue : le public ne voit que les épreuves validées ─────
-- Les 4 épreuves existantes (curées) sont marquées valides ; leur titre
-- harmonisé est initialisé sur le titre actuel.
update public.epreuves set valide = true where valide = false and titre_harmonise is null;
update public.epreuves set titre_harmonise = titre where titre_harmonise is null;

-- La policy de lecture publique passe de using(true) à using(valide).
-- Les imports en masse (valide=false) restent invisibles jusqu'à validation.
alter policy "lecture publique" on public.epreuves using (valide = true);

-- ── Rollback ─────────────────────────────────────────────────────────
-- alter policy "lecture publique" on public.epreuves using (true);
-- alter table public.epreuves drop column if exists valide, drop column if exists hash_md5, ... ;
