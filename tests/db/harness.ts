// Harness d'intégration base de données — Phase P2.
//
// Exécute la CHAÎNE COMPLÈTE des migrations (0001 → 0014) dans un vrai
// Postgres en mémoire (PGlite / WASM), sans dépendance externe ni accès à
// la base de production. Reproduit fidèlement l'environnement Supabase :
//   - schémas `auth` et `storage` stubs (auth.users, auth.uid(), buckets) ;
//   - rôles anon / authenticated / service_role ;
//   - privilèges par défaut Supabase (anon = select, authenticated = DML),
//     de sorte que les REVOKE de moindre privilège (0004/0005/0013) et les
//     policies RLS soient testés exactement comme en production.
//
// Permet de prouver : additivité, vues de compatibilité, RLS, triggers,
// fonctions de versionnage — le tout reproductible en CI.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'migrations'
);

/** Liste ordonnée des fichiers de migration (0001 → n). */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export function migrationSql(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
}

const SEEDS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase',
  'seeds'
);

export function seedSql(file: string): string {
  return readFileSync(join(SEEDS_DIR, file), 'utf8');
}

/** Environnement Supabase minimal : schémas, rôles, privilèges par défaut. */
const BOOTSTRAP = `
  create schema if not exists auth;
  create schema if not exists storage;

  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
  );

  create table if not exists storage.buckets (
    id     text primary key,
    name   text not null,
    public boolean not null default false
  );

  -- auth.uid() lit une GUC de session positionnée par les tests.
  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('test.uid', true), '')::uuid
  $fn$;

  -- Rôles Supabase.
  do $roles$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end
  $roles$;

  grant usage on schema public  to anon, authenticated, service_role;
  grant usage on schema auth     to anon, authenticated, service_role;
  grant usage on schema storage  to anon, authenticated, service_role;

  -- Privilèges par défaut façon Supabase : appliqués aux objets créés
  -- ENSUITE par le rôle courant (postgres) → toutes les tables des migrations.
  alter default privileges in schema public grant select on tables to anon;
  alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
  alter default privileges in schema public grant all on tables to service_role;
  alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
`;

export interface TestDb {
  db: PGlite;
  /** Exécute en tant que rôle donné, avec un uid de session optionnel. */
  asRole: (
    role: 'anon' | 'authenticated' | 'service_role' | 'postgres',
    uid?: string | null
  ) => Promise<void>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

/** Démarre une base neuve avec toutes les migrations appliquées. */
export async function setupDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const file of migrationFiles()) {
    try {
      await db.exec(migrationSql(file));
    } catch (e) {
      throw new Error(`Échec migration ${file} : ${(e as Error).message}`);
    }
  }

  const asRole: TestDb['asRole'] = async (role, uid) => {
    await db.exec('reset role;');
    await db.query('select set_config($1, $2, false)', ['test.uid', uid ?? '']);
    if (role !== 'postgres') await db.exec(`set role ${role};`);
  };

  return {
    db,
    asRole,
    reset: async () => {
      await db.exec('reset role;');
      await db.query('select set_config($1, $2, false)', ['test.uid', '']);
    },
    close: async () => {
      await db.close();
    },
  };
}
