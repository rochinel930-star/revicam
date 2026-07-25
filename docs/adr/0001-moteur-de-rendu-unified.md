# ADR 0001 — Migration du moteur de rendu Markdown : `marked` → `unified`

- **Statut** : Accepté
- **Date** : 2026-07-25
- **Phase** : R0 (couture architecturale, iso-comportement)
- **Portée** : `src/lib/markdown.ts`, nouveau `src/lib/render/processor.ts`

## Contexte

Le rendu du contenu pédagogique (leçons, énoncés, corrigés) repose sur `marked`.
La feuille de route R1→R6 exige des capacités que `marked` ne fournit pas nativement
sans greffes fragiles : mathématiques (KaTeX), chimie (`\ce{}`), assainissement HTML
strict (contenu généré par IA jamais fiable), blocs pédagogiques structurés
(`:::` directives), le tout **rendu au moment de l'écriture** et servi en HTML statique
(zéro JavaScript client).

`unified` (remark/rehype) est l'écosystème standard pour composer ces étapes comme des
plugins d'une même chaîne AST, ce que `marked` (parseur monolithique orienté chaîne)
ne permet pas proprement.

R0 **ne livre aucune de ces fonctionnalités**. R0 remplace uniquement le moteur
sous-jacent, à comportement visuel identique, pour établir le socle sur lequel R1→R6
viendront brancher leurs plugins. Aucun point d'extension spéculatif n'est ajouté :
le seul artefact nouveau est la chaîne minimale strictement équivalente à l'existant.

## Décision

Introduire `src/lib/render/processor.ts` exposant `markdownToHtml(src: string): string`,
construit sur la chaîne :

```
remark-parse → remark-gfm → remark-rehype (allowDangerousHtml) → rehype-raw → rehype-stringify
```

`src/lib/markdown.ts` conserve **exactement** son API publique (`mdToHtml`, même
signature `(src: string | null | undefined): string`) et sa regex d'encadrés
`:::formule|definition|exemple` ; seuls les deux appels internes à `marked.parse`
sont remplacés par `markdownToHtml`. Aucun site d'appel externe n'est modifié.

Cette chaîne reproduit le comportement de `marked` configuré `{ gfm: true }` :
Markdown de base, tableaux/listes de tâches GFM, et **HTML brut préservé**
(`rehype-raw`), ce qui maintient le passage tel quel du SVG inline et des `<div>`
d'encadrés déjà rendus.

## Alternatives rejetées

- **Conserver `marked` et y greffer maths/chimie/sanitize** — rejeté : `marked`
  opère sur des chaînes, pas un AST ; empiler des extensions et des regex pré/post
  pour KaTeX + assainissement fiable devient ingérable et non sûr. C'est précisément
  la dette que R1→R6 doivent éviter.
- **`markdown-it` + plugins** — écosystème valable, mais son modèle de tokens est
  moins adapté à la transformation AST → HAST → assainissement que remark/rehype ;
  `rehype-katex` / `rehype-sanitize` sont l'état de l'art côté unified.
- **Rendu MDX / composants React client** — rejeté : contredit la contrainte « zéro
  JS client » et « render-at-write ». Le contenu doit être du HTML statique.
- **Reporter la migration (tout faire en R1)** — rejeté : mélanger le changement de
  moteur avec l'ajout des maths rendrait impossible d'isoler une régression. R0
  découple le risque « changement de moteur » du risque « nouvelles fonctionnalités ».

## Dépendances ajoutées

Toutes sous licence **MIT**, maintenues par le collectif unified (référence de
l'écosystème remark/rehype, des millions de téléchargements/semaine), sans dépendance
native ni script d'installation. **Elles restent strictement côté serveur** (rendu
SSG/ISR) : vérifié, aucune trace dans le bundle client.

| Paquet | Version | Rôle en R0 | Justification |
|---|---|---|---|
| `unified` | ^11 | Orchestrateur de la chaîne | Socle commun R0→R6 |
| `remark-parse` | ^11 | Markdown → mdast | Équivalent du parseur `marked` |
| `remark-gfm` | ^4 | Tableaux, listes de tâches, autoliens | Parité avec `marked {gfm:true}` |
| `remark-rehype` | ^11 | mdast → hast | Pont vers le rendu HTML/HAST |
| `rehype-raw` | ^7 | Réintègre le HTML brut (SVG inline, encadrés) | Parité : `marked` laissait passer le HTML |
| `rehype-stringify` | ^10 | hast → chaîne HTML | Sérialisation finale |

**Dépendance retirée** : `marked` (devenue morte, plus aucune référence dans le code
ni dans le bundle).

## Conséquences

**Positives** — Socle prêt pour R1 (brancher `remark-math` + `rehype-katex`), R2
(`rehype-sanitize`), R5 (`remark-directive`) sans nouveau changement de moteur. Modèle
AST transformable et assainissable, adapté à du contenu non fiable.

**Neutres / à connaître** — Deux différences de **sérialisation** par rapport à
`marked`, toutes deux **rendues à l'identique par le navigateur**, donc sans régression
visuelle :
1. `marked` encode l'apostrophe `'` en `&#39;` ; la chaîne rehype la laisse `'`.
   Preuve : dans le DOM rendu de la leçon L4, **0 occurrence littérale de `&#39;`** —
   le caractère affiché est la même apostrophe.
2. `marked` auto-ferme les éléments SVG vides (`<line/>`) ; `rehype-raw` les écrit en
   forme longue (`<line></line>`). Rendu identique.

L'« iso-comportement » de R0 est donc **équivalence sémantique et visuelle**, pas
égalité octet-à-octet — distinction assumée et documentée.

**Coût** — 6 dépendances serveur supplémentaires (arbre unified), sans impact sur le
bundle client (mesuré identique : 16 fichiers / ~661 kB avant comme après).

## Stratégie de rollback

Changement additif et localisé, réversible en quelques minutes :

1. `git revert` du commit R0 (rétablit `src/lib/markdown.ts` sur `marked` et supprime
   `src/lib/render/processor.ts`) ; **ou** manuellement : réinstaller `marked`,
   restaurer les deux appels `marked.parse`.
2. `npm install marked && npm uninstall unified remark-parse remark-gfm remark-rehype rehype-raw rehype-stringify`.
3. `npm run render:check && npm run build` pour revalider.

Aucune migration de données, aucun changement de schéma, aucun contenu ré-importé :
le rollback n'a aucun effet de bord. L'API publique étant inchangée, aucun autre
fichier n'est concerné dans un sens comme dans l'autre.
