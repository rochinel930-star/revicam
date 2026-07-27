# Registre de dette technique — RéviCam

Foyer unique de la dette technique connue. Toute décision de reporter une
correction s'inscrit ici (cf. Handbook P1.6). Statuts : `ouvert`,
`en-cours`, `résolu`, `accepté` (dette assumée, non planifiée).

| ID | Sévérité | Sujet | Détail | Statut | Origine |
|----|----------|-------|--------|--------|---------|
| TD-001 | basse | Avertissement ESLint `cle` (BilingualGame) | Warning intentionnel documenté, conservé volontairement. Non bloquant. | accepté | W0.2 |
| TD-002 | moyenne | Matrice RLS live non exécutée en CI | `tests/security/rls-matrix.spec.ts` : les vérifications live sont opt-in (`RLS_LIVE=1`) pour garder la CI hors-réseau et déterministe. À câbler sur un environnement staging en P17. | ouvert | P1 |
| TD-003 | basse | CSP `script-src 'unsafe-inline'` | Toléré tant que Next injecte le bootstrap d'hydratation sans nonce. Durcir via middleware à nonce quand le périmètre le justifiera. | accepté | P1 |
| TD-004 | basse | Flags : pas de cache TTL sur `getFlagRemote` | Lecture base à chaque appel distant. Acceptable (usage hors chemin chaud) ; ajouter un cache mémoire si un flag distant entre dans le chemin chaud. | accepté | P1 |
| TD-005 | basse | Lectures applicatives via `modules` (pas encore `chapitre`) | Les pages lisent toujours la table `modules` (présente en prod). La bascule vers la vue canonique `chapitre` + lectures programme/série est reportée aux phases consommatrices (P7/P10) pour éviter code mort et régression pré-migration. Vue `chapitre` validée en intégration. | accepté | P2 |
| TD-006 | moyenne | Migrations 0007–0014 non appliquées à la prod | Validées en intégration PGlite (0001→0014). L'application à la base de production est une étape d'exploitation externe (voir rapport P2). | ouvert | P2 |

## Convention

- Ajouter une ligne AVANT de reporter une correction (jamais de dette silencieuse).
- Lier l'ID (`TD-0xx`) dans le code (commentaire) et dans les PR concernées.
- Revue du registre à chaque clôture de phase.
