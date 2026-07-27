-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0009 : séquence pédagogique + vue canonique chapitre
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2. Le concept « module » devient canoniquement « chapitre ».
--
-- Décision d'architecture (ADR 0003) : `modules` RESTE la table physique
-- (le pipeline d'import y écrit via upsert/onConflict — la transformer en
-- vue casserait l'import). `chapitre` est exposé comme VUE CANONIQUE
-- additive, auto-modifiable (select simple sur une table → insertable),
-- au-dessus de `modules`. Foyer physique unique, deux noms : aucune
-- duplication de données. Rétro-compatible (l'existant lit `modules`),
-- forward-compatible (le neuf lit `chapitre`).
--
-- 100 % ADDITIVE.

-- ── Séquence (regroupement pédagogique APC, transversal aux chapitres) ─
create table sequence (
  id           uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programme(id) on delete cascade,
  numero       int  not null,
  nom          text not null,
  unique (programme_id, numero)
);
create index sequence_programme_idx on sequence(programme_id);

-- ── Rattachement des chapitres (modules) au V2 (nullable → backfill 0014)
alter table modules
  add column programme_id uuid references programme(id) on delete restrict,
  add column sequence_id  uuid references sequence(id)  on delete set null;

create index modules_programme_idx on modules(programme_id);
create index modules_sequence_idx  on modules(sequence_id);

-- ── Trigger : défaut programme_id depuis la classe ───────────────────
-- Garantit que tout chapitre inséré (y compris par l'import, qui ne
-- connaît pas programme_id) hérite du programme de sa classe. Zéro
-- régression : l'import continue d'insérer sans programme_id.
create or replace function fn_default_programme_from_classe()
returns trigger language plpgsql as $$
begin
  if new.programme_id is null and new.classe_id is not null then
    select c.programme_id into new.programme_id from classes c where c.id = new.classe_id;
  end if;
  return new;
end;
$$;

create trigger trg_modules_default_programme
  before insert or update on modules
  for each row execute function fn_default_programme_from_classe();

-- ── VUE CANONIQUE chapitre (auto-modifiable) ─────────────────────────
create view chapitre
with (security_barrier)
as
  select
    id,
    programme_id,
    classe_id,
    matiere_id,
    sequence_id,
    numero,
    titre
  from modules;

grant select on chapitre to anon, authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop view if exists chapitre;
-- drop trigger if exists trg_modules_default_programme on modules;
-- drop function if exists fn_default_programme_from_classe();
-- alter table modules drop column if exists sequence_id, drop column if exists programme_id;
-- drop table if exists sequence;
