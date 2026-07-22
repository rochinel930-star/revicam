# 📦 Contenu RéviCam — formats d'import

**Ce dossier est le seul endroit où l'on ajoute du contenu.** Aucune modification
de code n'est nécessaire : déposer un fichier au bon format, lancer
`npm run import`, pousser sur GitHub → Vercel redéploie → le contenu est en ligne.

```
/content
  structure.json                 ← référentiel (classes, matières, modules)
  /lecons/<matiere>/module-<N>/LXX-slug.mdx
  /compositions/<matiere>/slug.json
  /epreuves/epreuves.csv         ← métadonnées des épreuves
  /epreuves/pdf/                 ← PDF locaux à téléverser (optionnel)
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run import` | Valide tout `/content` puis écrit dans Supabase. **Idempotent** : ré-importer met à jour, ne duplique jamais. Exige `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`. |
| `npm run import -- --dry-run` | Valide seulement (aucune écriture). À lancer avant de pousser. |
| `npm run import -- --sql seed.sql` | Génère le SQL équivalent, à coller dans l'éditeur SQL du dashboard Supabase (utile sans clé service). |

En cas de champ manquant ou de format invalide, l'import s'arrête **avant toute
écriture** avec la liste précise des erreurs (fichier + problème).

---

## 1. Gabarit LEÇON (`.mdx`)

Fichier : `content/lecons/<matiere>/module-<N>/LXX-<slug>.mdx`
(le nom de fichier est libre, seul le frontmatter fait foi).

Une leçon **sans section `## Cours`** ou avec `publie: false` apparaît sur le
site comme « 📝 Cette leçon arrive bientôt » (avec ses objectifs si fournis).

````markdown
---
classe: premiere-d
matiere: physique
module: 2                # numéro du module (déclaré dans structure.json)
numero: 5                # numéro global de la leçon (L5)
titre: Énergie cinétique
slug: energie-cinetique  # utilisé dans l'URL
duree: 25                # minutes de lecture estimées
publie: true             # false = « en rédaction »
objectifs:
  - "Définir l'énergie cinétique d'un solide en translation"
  - "Appliquer le théorème de l'énergie cinétique"
---

## Cours

Texte du cours en markdown : titres `### `, listes, tableaux, **gras**…
Les schémas sont des SVG inline collés directement dans le texte.

Encadrés spéciaux (3 types) :

:::definition Énergie cinétique
L'énergie que possède un corps du fait de son mouvement.
:::

:::formule Théorème de l'énergie cinétique
ΔEc = Ec₂ − Ec₁ = ΣW(F⃗)
:::

:::exemple Exemple résolu — taxi de Yaoundé
Énoncé puis solution pas à pas…
:::

## Essentiel

Fiche mémo condensée (markdown). Affichée dans l'encadré or +
téléchargeable par l'élève.

## JeuBilingue

| Français | English |
|---|---|
| énergie cinétique | kinetic energy |
| vitesse | speed / velocity |

## QCM

### Q1
L'unité de l'énergie cinétique dans le S.I. est :

- [ ] le watt (W)
- [x] le joule (J)
- [ ] le newton (N)

> Explication : L'énergie, quelle que soit sa forme, se mesure en joules.

### Q2
(… 10 à 15 questions ; cocher `[x]` la ou les bonnes réponses ;
l'explication `>` est facultative mais recommandée)

## Exercices

### Exercice 1 — Camion sur la falaise de Dschang
Énoncé complet de l'exercice type examen…

#### Corrigé
Corrigé détaillé pas à pas (masqué derrière un bouton sur le site).

### Exercice 2 — …
````

**Règles :**
- `classe`, `matiere`, `module`, `numero`, `titre`, `slug` sont obligatoires.
- `publie: true` exige une section `## Cours`.
- Toutes les sections sont optionnelles pour une leçon en rédaction.
- Un QCM doit avoir ≥ 2 options et ≥ 1 bonne réponse `[x]`.

---

## 2. Gabarit COMPOSITION (`.json`)

Fichier : `content/compositions/<matiere>/<slug>.json`

```json
{
  "slug": "phy-1d-seq2-travail-energie",
  "titre": "Épreuve séquentielle n°2 — Travail et énergie",
  "classe": "premiere-d",
  "matiere": "physique",
  "duree_minutes": 60,
  "mode_affichage": "liste",
  "publie": true,
  "questions": [
    {
      "type": "qcm",
      "enonce": "Le travail d'une force constante F⃗ dont le point d'application se déplace de d s'écrit :",
      "options": ["W = F × d × cos α", "W = F / d", "W = F × d²"],
      "bonnes_reponses": [0],
      "bareme": 1.5,
      "lecon": "module-2/travail-d-une-force"
    },
    {
      "type": "libre",
      "enonce": "Un ouvrier tire une caisse de 40 kg sur 15 m… Calculer le travail du poids.",
      "corrige_type": "Le déplacement est horizontal donc le travail du poids est nul : W(P⃗) = 0 J. Démarche attendue : remarquer que P⃗ ⊥ déplacement.",
      "bareme": 4,
      "lecon": "module-2/travail-d-une-force"
    }
  ]
}
```

**Règles :**
- `slug` est la clé : ré-importer le même slug met à jour la composition.
- `mode_affichage` : `"liste"` (questions scrollables) ou `"une_par_une"`.
- `bonnes_reponses` : indices des bonnes options, **base 0**. Jamais envoyés au navigateur avant soumission.
- Toute question `libre` **doit** avoir un `corrige_type` : c'est la référence
  donnée au correcteur IA. Sans corrigé fourni, ne pas créer la question.
- `lecon` (optionnel mais fortement recommandé) : référence `module-N/slug`
  d'une leçon de la même classe/matière. C'est ce qui alimente le
  **diagnostic « leçons à réviser »** sur l'écran de résultats.
- Le barème total est calculé automatiquement (somme des `bareme`).

---

## 3. Gabarit ÉPREUVES (`epreuves.csv`)

Fichier : `content/epreuves/epreuves.csv` — une ligne par épreuve.

```csv
classe,matiere,type,numero_sequence,annee,serie,etablissement,titre,pdf,composable,composition_slug,lecons
premiere-d,physique,sequentielle,2,2025,D,Lycée de Biyem-Assi,"Séquence n°2 — Travail et énergie",sequence2-2025.pdf,true,phy-1d-seq2-travail-energie,module-2/travail-d-une-force;module-2/energie-cinetique
premiere-d,physique,officiel,,2024,D,,"Probatoire D 2024 — Physique",https://exemple.cm/proba-d-2024.pdf,false,,
```

| Colonne | Valeurs |
|---|---|
| `type` | `sequentielle` \| `composition` \| `blanc` \| `officiel` \| `controle` |
| `numero_sequence` | 1 à 6 pour les séquentielles, vide sinon |
| `serie` | A, C, D, TI… (vide si non applicable) |
| `pdf` | URL complète, chemin `/public` (ex. `/epreuves-demo/x.pdf`), ou nom d'un fichier placé dans `content/epreuves/pdf/` (téléversé automatiquement vers Supabase Storage) |
| `composable` | `true` si l'épreuve a été numérisée en composition interactive |
| `composition_slug` | slug de la composition liée (obligatoire si `composable=true`) |
| `lecons` | références `module-N/slug` séparées par `;` — alimente « Sujets liés » sur les pages leçons |

Mettre les champs contenant des virgules entre guillemets `"..."`.

---

## Référentiel (`structure.json`)

Déclare les classes, matières (avec couleur et icône) et modules.
À modifier uniquement pour ouvrir une nouvelle classe, matière ou module.
Les leçons, compositions et épreuves y font référence par slug — un slug
inconnu bloque l'import avec une erreur claire.
