-- ═══════════════════════════════════════════════════════════════════
-- RéviCam — migration 0013 : RLS multi-programme + moindre privilège
-- ═══════════════════════════════════════════════════════════════════
-- Phase P2. Généralise le contrat de sécurité aux tables V2 :
--   - référentiel (pays/programme/niveau/serie/sequence) : lecture publique
--     (même patron que classes/matieres — RLS + policy select using(true)),
--     avec grants explicites de moindre privilège ;
--   - content_version : SECRET — lecture réservée au staff (is_staff()),
--     écriture via service_role uniquement (append-only, cf. 0012) ;
--   - staff : chacun ne voit que son appartenance.
--
-- service_role contourne la RLS (routes serveur, import). 100 % ADDITIVE.

-- ── Activer la RLS partout ───────────────────────────────────────────
alter table pays            enable row level security;
alter table programme       enable row level security;
alter table niveau          enable row level security;
alter table serie           enable row level security;
alter table sequence        enable row level security;
alter table content_version enable row level security;
alter table staff           enable row level security;

-- ── Référentiel : lecture publique ───────────────────────────────────
create policy "lecture publique" on pays      for select using (true);
create policy "lecture publique" on programme  for select using (true);
create policy "lecture publique" on niveau     for select using (true);
create policy "lecture publique" on serie      for select using (true);
create policy "lecture publique" on sequence   for select using (true);

-- ── content_version : lecture staff uniquement (secret-by-default) ───
create policy "lecture staff de l'historique" on content_version
  for select using (is_staff());

-- ── staff : chacun son appartenance ──────────────────────────────────
create policy "lire son appartenance staff" on staff
  for select using (user_id = auth.uid());

-- ── Grants de moindre privilège ──────────────────────────────────────
-- Référentiel : lecture seule pour anon/authenticated.
revoke all privileges on table pays      from anon, authenticated;
revoke all privileges on table programme  from anon, authenticated;
revoke all privileges on table niveau     from anon, authenticated;
revoke all privileges on table serie      from anon, authenticated;
revoke all privileges on table sequence   from anon, authenticated;
grant  select on table pays      to anon, authenticated;
grant  select on table programme  to anon, authenticated;
grant  select on table niveau     to anon, authenticated;
grant  select on table serie      to anon, authenticated;
grant  select on table sequence   to anon, authenticated;

-- content_version : aucun accès direct anon/authenticated (RLS + pas de grant).
-- La policy staff s'applique aux sessions authentifiées disposant du grant ;
-- on accorde le select à authenticated, filtré par is_staff().
revoke all privileges on table content_version from anon, authenticated;
grant  select on table content_version to authenticated;

-- staff : lecture de sa propre ligne pour authenticated ; rien pour anon.
revoke all privileges on table staff from anon, authenticated;
grant  select on table staff to authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────
-- drop policy if exists "lire son appartenance staff" on staff;
-- drop policy if exists "lecture staff de l'historique" on content_version;
-- drop policy if exists "lecture publique" on sequence;
-- drop policy if exists "lecture publique" on serie;
-- drop policy if exists "lecture publique" on niveau;
-- drop policy if exists "lecture publique" on programme;
-- drop policy if exists "lecture publique" on pays;
-- (les alter ... disable row level security sont laissés au rollback manuel)
