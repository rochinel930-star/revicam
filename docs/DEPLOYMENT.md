# RéviCam — Guide de déploiement (Release Candidate v1.0.0-rc.1)

Document d'exploitation de la RC : prérequis, inventaires, et checklists de
déploiement / rollback / validation post-déploiement. Aucune de ces actions
n'est exécutée automatiquement — ce sont les **actions humaines** listées au §9.

---

## 1. Vue d'ensemble

- **Dépôt** : `github.com/rochinel930-star/revicam`
- **Hébergement** : Vercel (`revicam.vercel.app`)
- **Base** : Supabase (projet `xjzthitjhplgrsfdaial`)
- **Stack** : Next.js 16 (App Router), React 19, TS strict, Tailwind 4,
  `@supabase/supabase-js`, `@anthropic-ai/sdk`, moteur unified/KaTeX (MathML).
- **Branche RC** : `feat/post-p2-waves` (9 commits P1→P8 au-dessus de `main`).
- **Production actuelle** : `main = e34b771` (P0 uniquement).

---

## 2. Prérequis

### 2.1 GitHub
- [ ] Droits de push sur le dépôt.
- [ ] (Recommandé) Protection de branche `main` : exiger le job **CI / build**
      (`.github/workflows/ci.yml`) avant merge.
- [ ] Secrets d'Actions non requis pour la CI (build sans secret : replis dans
      `src/lib/supabase.ts`).

### 2.2 Supabase
- [ ] Accès au projet `xjzthitjhplgrsfdaial` (ou projet cible).
- [ ] Capacité d'exécuter du SQL (éditeur SQL ou CLI) pour appliquer les
      migrations `0006` → `0018`.
- [ ] (P6) Auth : configurer les **Redirect URLs** (`{SITE_URL}/mon-espace`) et
      les templates e-mail (lien magique).
- [ ] Rôles `anon` / `authenticated` / `service_role` (par défaut Supabase).

### 2.3 Vercel
- [ ] Projet lié au dépôt, build `next build`, Node 20.
- [ ] Variables d'environnement définies (voir §4) pour Production/Preview.
- [ ] Domaine `revicam.vercel.app` actif.

---

## 3. Inventaire des migrations

Ordre strict, additif. **En production (P0)** : `0001`–`0005` déjà appliquées.
**À appliquer pour la RC** : `0006` → `0018`.

| # | Fichier | Phase | Objet |
|---|---|---|---|
| 0001 | init | P0 | schéma initial + RLS + `questions_public` |
| 0002 | lecon_qcm_exercices | P0 | colonnes qcm/exercices |
| 0003 | lecons_public | P0 | vue publique leçons |
| 0004 | lecons_rls_publie | P0 | RLS publie=true |
| 0005 | lecons_grants_least_privilege | P0 | moindre privilège |
| 0006 | feature_flags | P1 | table flags + vue publique |
| 0007 | pays_programme | P2 | pays / programme / niveau |
| 0008 | classe_serie_matiere | P2 | serie + rattachement classes |
| 0009 | chapitre_sequence | P2 | sequence + vue `chapitre` + trigger |
| 0010 | lecon_rattachement | P2 | lecon.chapitre_id / current_version_id |
| 0011 | epreuves_examens | P2 | examens BEPC/Prob/Bac + serie/session |
| 0012 | versioning | P2 | content_version + snapshot/restore + staff |
| 0013 | rls_multiprogramme | P2 | RLS + moindre privilège V2 |
| 0014 | backfill_cameroun | P2 | seed + backfill |
| 0015 | savoir | P3 | notion/competence/objectif_apc |
| 0016 | jonctions | P3 | jonctions + vue traversée |
| 0017 | ingestion_staging | P4 | staging ingestion (secret) |
| 0018 | lesson_artifact | P8 | artefacts IA + vue publique |
| 0019 | security_hardening | RC | search_path des fonctions + EXECUTE is_staff restreint |
| 0020 | is_staff_anon_revoke | RC | is_staff() non appelable par anon (RPC) |

**Validation locale préalable** : la chaîne `0001`→`0018` est exécutée dans un
Postgres réel en mémoire (PGlite) par `npm test` (tests `tests/db/*`) —
additivité, RLS, vues, triggers, fonctions prouvés hors production.

**Seed optionnel** : `supabase/seeds/terminale-c.sql` (démonstration
« ajouter une classe = insertion de lignes »).

---

## 4. Inventaire des variables d'environnement

| Variable | Secret | Où | Requis | Rôle |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | non | client+serveur | oui¹ | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | non | client+serveur | oui¹ | clé anon (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **oui** | serveur | pour API serveur / import / génération | bypass RLS |
| `ANTHROPIC_API_KEY` | **oui** | serveur | pour correction/notation IA | Claude |
| `NEXT_PUBLIC_SITE_URL` | non | client+serveur | recommandé | liens absolus, redirect auth |
| `ADMIN_API_TOKEN` | **oui** | serveur | pour `/api/admin/*` | garde admin (503 si absent) |
| `FLAG_<CLÉ>` | non | serveur | non | surcharge de flag (ex. `FLAG_HEALTH_VERBOSE`) |

¹ Des valeurs de repli publiques existent (`src/lib/supabase.ts`) pour un build
reproductible ; définir les variables reste recommandé.

### Secrets attendus (à ne jamais committer)
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_API_TOKEN`.
Le fichier `.env.example` documente l'ensemble ; `.env.local` est ignoré par git.

---

## 5. Checklist de déploiement (RC → Production)

> Chaque étape est une **action humaine** (voir §9). L'ordre est important.

1. [ ] **Pré-vol local** : `npm ci` puis `npm run typecheck && npm run lint &&
       npm run render:check && npm test && npm run build` — toutes vertes.
2. [ ] **Pousser la branche** `feat/post-p2-waves` et ouvrir une PR vers `main`.
3. [ ] **CI verte** sur la PR (job `build`).
4. [ ] **Base — staging d'abord** : appliquer `0006`→`0018` sur une branche
       Supabase / projet de staging. Vérifier l'absence d'erreur, puis les RLS
       (voir §7).
5. [ ] **Backfill** : `0014` seede pays/programme/niveaux/séries et rattache
       l'existant. Vérifier les comptes (7 niveaux, 5 séries).
6. [ ] **Variables Vercel** : renseigner §4 (au minimum Supabase ; les secrets IA
       et `ADMIN_API_TOKEN` uniquement si ingestion/notation activées).
7. [ ] **Fusionner** la PR dans `main` (déclenche le déploiement Vercel).
8. [ ] **Base — production** : appliquer `0006`→`0018` sur la base de prod
       (après succès en staging).
9. [ ] **(Optionnel P6)** configurer Supabase Auth (redirect + e-mails).
10. [ ] **(Optionnel P4/P8)** enregistrer un adaptateur LLM + clés, puis
        `npm run generate` pour peupler le cache d'artefacts.
11. [ ] **Validation post-déploiement** (voir §8).

---

## 6. Checklist de rollback

Le code et les migrations sont conçus pour un retour arrière sûr.

- **Code / déploiement** : Vercel → *Redeploy* du build précédent (ou
  `git revert` du merge puis push). Le socle P0 (`e34b771`) reste une cible de
  repli connue.
- **Feature flags** : désactiver un comportement sans redéploiement via
  `FLAG_<CLÉ>=0` (env) ou la table `feature_flags`.
- **Migrations** : chaque fichier `0006`→`0018` documente un bloc **Rollback**
  (commenté) en bas. Elles sont **additives** : un retour du code n'exige pas de
  défaire le schéma (rétro-compatible). En cas de besoin, appliquer les
  rollbacks dans l'ordre inverse (`0018` → `0006`).
- **Administration** : retirer `ADMIN_API_TOKEN` désactive instantanément
  `/api/admin/*` (503).
- **Contenu / versions** : `fn_restore_lecon_version()` restaure une leçon à une
  version antérieure (historique append-only préservé).

> ⚠️ Ne jamais appliquer un rollback destructif (`drop table`) sur une base
> contenant des données de production sans sauvegarde préalable.

---

## 7. Vérification RLS (staging)

Après application des migrations sur staging, confirmer (SQL, rôle `anon`) :
- [ ] `select` sur `lecons`, `questions`, `feature_flags`, `content_version`,
      `ingestion_job`, `lesson_artifact` → **refusé ou vide** (secret-by-default).
- [ ] `select` sur `lecons_public`, `questions_public`, `feature_flags_public`,
      `chapitre`, `programme`, `niveau`, `serie`, `lesson_artifact_public` → **OK**.
- [ ] `lesson_artifact_public` n'expose **jamais** la colonne `secret`.
- [ ] Ces invariants sont déjà prouvés hors-ligne par `tests/db/*` (PGlite).

---

## 8. Checklist de validation post-déploiement

- [ ] `GET /` → 200.
- [ ] `GET /api/health` → 200, `status: "up"`, en-tête `x-request-id`.
- [ ] En-têtes de sécurité présents sur `/` (CSP, X-Frame-Options, …).
- [ ] Une leçon publiée s'affiche avec maths (MathML) et SVG intacts sous CSP.
- [ ] `GET /offline` → 200 ; PWA installable (manifest chargé).
- [ ] `GET /connexion` → 200 (si P6 configuré : lien magique reçu par e-mail).
- [ ] `/admin/revue` → vide pour un visiteur non-staff (secret-by-default).
- [ ] Salle de Composition : soumission → correction (hybride) fonctionnelle.
- [ ] (Si génération lancée) une leçon affiche la section « Outils IA ».
- [ ] Aucune erreur bloquante dans les logs Vercel.

---

## 9. Actions humaines restantes (avant mise en production)

Ces actions sont **hors périmètre autonome** (distantes / sensibles / secrets) :

1. **Pousser** `feat/post-p2-waves` et ouvrir la PR vers `main`.
2. **Appliquer les migrations `0006`→`0018`** sur Supabase (staging puis prod).
3. **Définir les variables/secrets** Vercel (§4) — notamment
   `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_API_TOKEN`.
4. **Fusionner / déployer** (merge PR → déploiement Vercel).
5. **(P6)** configurer Supabase Auth (redirect URLs + templates e-mail).
6. **(P4/P8)** enregistrer un adaptateur LLM concret et lancer `npm run generate`.
7. **(Recommandé)** activer la protection de branche `main` sur GitHub.

Tout le reste (code, migrations, tests, docs, checklists) est prêt dans la RC.
