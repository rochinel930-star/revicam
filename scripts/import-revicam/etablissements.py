# Normalisation des établissements — dictionnaire local (GRATUIT, déterministe).
# Développe les abréviations cryptiques AVANT tout appel IA : plus rapide, plus
# cohérent, et zéro token. L'IA ne sert de secours que pour les inconnus.

import re

# Correspondances abréviation/variante -> nom complet officiel.
ETABLISSEMENTS = {
    r"\bcol(?:lege)?\.?\s*vogt\b|\bvogt\b": "Collège François-Xavier Vogt",
    r"\bl\.?\s*g\.?\s*l\.?\b|lyc[ée]e\s+g[ée]n[ée]ral\s+leclerc": "Lycée Général Leclerc",
    r"\bcol(?:lege)?\.?\s*libermann?\b|\blibermann?\b": "Collège Libermann",
    r"\bcol(?:lege)?\.?\s*jean\s*tabi\b|\bjean\s*tabi\b": "Collège Jean Tabi",
    r"\bcol(?:lege)?\.?\s*(?:de\s+)?la\s*retraite\b": "Collège de la Retraite",
    r"\bcol(?:lege)?\.?\s*mongo\s*beti\b|\bmongo\s*beti\b": "Collège Mongo Beti",
    r"\bg\.?\s*b\.?\s*h\.?\s*s\b": "Government Bilingual High School",
    r"\blyc[ée]e\s+bilingue\b": "Lycée Bilingue",
    r"\benset\b": "ENSET",
}

# Signale un examen officiel national (pas d'établissement particulier).
OFFICIEL = re.compile(
    r"\bminesec\b|\bofficiel\b|harmonis[ée]\s+national|\bbaccalaur[ée]at\b|\bprobatoire\b|\bbepc\b|\bg\.?c\.?e\b|examen\s+national",
    re.I,
)


def normaliser_etablissement(entete: str) -> str | None:
    """Développe l'abréviation d'établissement depuis l'en-tête (déterministe)."""
    texte = entete or ""
    for motif, complet in ETABLISSEMENTS.items():
        if re.search(motif, texte, re.I):
            return complet
    if OFFICIEL.search(texte):
        return "Officiel MINESEC"
    # Capture générique « Lycée … » / « Collège … » (à valider en revue).
    m = re.search(r"\b(lyc[ée]e|coll[èe]ge|institut|complexe scolaire)\b[^\n,;.:]{2,45}", texte, re.I)
    if m:
        return re.sub(r"\s+", " ", m.group(0)).strip().title()
    return None
