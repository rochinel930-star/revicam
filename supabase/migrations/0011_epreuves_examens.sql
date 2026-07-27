-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0011 : examens officiels (BEPC / Probatoire / Bac)
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2. Étend le catalogue d'épreuves aux examens nationaux et
-- rattache épreuves & compositions au référentiel V2.
--
-- Élargissement du CHECK `type` : ADDITIF au sens des données — l'ensemble
-- autorisé est ÉLARGI (aucune valeur existante n'est invalidée, aucun
-- consommateur cassé). Colonnes ajoutées nullable. Triggers de défaut
-- programme (zéro régression pour l'import).

-- ── Élargir les types d'épreuve (ajout bepc/probatoire/baccalaureat) ──
alter table epreuves drop constraint if exists epreuves_type_check;
alter table epreuves add constraint epreuves_type_check
  check (type in (
    'sequentielle','composition','blanc','officiel','controle',
    'bepc','probatoire','baccalaureat','cep'
  ));

-- ── Rattachement examen : série, session, programme ──────────────────
alter table epreuves
  add column serie_id     uuid references serie(id)     on delete set null,
  add column programme_id uuid references programme(id) on delete restrict,
  add column session      text; -- ex. « normale », « rattrapage »

create index epreuves_serie_idx     on epreuves(serie_id);
create index epreuves_programme_idx on epreuves(programme_id);

-- ── Rattachement des compositions au programme ───────────────────────
alter table compositions
  add column programme_id uuid references programme(id) on delete restrict,
  add column serie_id     uuid references serie(id)     on delete set null;

create index compositions_programme_idx on compositions(programme_id);

-- ── Triggers de défaut programme (depuis la classe) ──────────────────
-- Réutilise fn_default_programme_from_classe() (0009).
create trigger trg_epreuves_default_programme
  before insert or update on epreuves
  for each row execute function fn_default_programme_from_classe();

create trigger trg_compositions_default_programme
  before insert or update on compositions
  for each row execute function fn_default_programme_from_classe();

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop trigger if exists trg_compositions_default_programme on compositions;
-- drop trigger if exists trg_epreuves_default_programme on epreuves;
-- alter table compositions drop column if exists serie_id, drop column if exists programme_id;
-- alter table epreuves drop column if exists session, drop column if exists programme_id, drop column if exists serie_id;
-- alter table epreuves drop constraint if exists epreuves_type_check;
-- alter table epreuves add constraint epreuves_type_check
--   check (type in ('sequentielle','composition','blanc','officiel','controle'));
