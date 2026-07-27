-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0010 : rattachement leçon → chapitre + versionnage
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2. Ajoute à `lecons` :
--   - chapitre_id      : FK canonique vers le chapitre (= modules.id),
--     backfillée depuis module_id (0014). module_id est CONSERVÉ pour la
--     rétro-compatibilité totale (l'import et les pages existantes s'en
--     servent). Foyer unique : chapitre_id et module_id désignent la même
--     ligne physique de `modules`.
--   - current_version_id : pointeur vers la version courante de contenu
--     (table content_version créée en 0012). Nullable.
--
-- Un trigger défaut garantit chapitre_id = module_id à l'insertion : le
-- pipeline d'import, qui insère sans chapitre_id, continue de fonctionner.
--
-- 100 % ADDITIVE.

alter table lecons
  add column chapitre_id        uuid references modules(id) on delete cascade,
  add column current_version_id uuid; -- FK ajoutée en 0012 (après content_version)

create index lecons_chapitre_idx on lecons(chapitre_id);

-- ── Trigger : défaut chapitre_id = module_id ─────────────────────────
create or replace function fn_default_chapitre_from_module()
returns trigger language plpgsql as $$
begin
  if new.chapitre_id is null then
    new.chapitre_id := new.module_id;
  end if;
  return new;
end;
$$;

create trigger trg_lecons_default_chapitre
  before insert or update on lecons
  for each row execute function fn_default_chapitre_from_module();

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop trigger if exists trg_lecons_default_chapitre on lecons;
-- drop function if exists fn_default_chapitre_from_module();
-- alter table lecons drop column if exists current_version_id, drop column if exists chapitre_id;
