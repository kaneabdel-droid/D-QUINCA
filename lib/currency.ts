// Devise de travail d'une entreprise — un seul code par entreprise, pas de
// comptabilité multi-devises avec taux de change. Point d'entrée unique pour
// tout affichage de montant : remplace les `Number(x).toLocaleString('fr-FR')`
// épars par un formatage qui respecte le nombre de décimales et le symbole de
// la devise choisie par l'entreprise (cf. /parametres).

export type DeviseCode = 'XOF' | 'XAF' | 'MRU' | 'MAD' | 'GNF' | 'EUR' | 'USD'

export const DEVISES: Record<DeviseCode, { label: string; symbole: string; decimales: number }> = {
  XOF: { label: 'Franc CFA — BCEAO (XOF)', symbole: 'FCFA', decimales: 0 },
  XAF: { label: 'Franc CFA — BEAC (XAF)', symbole: 'FCFA', decimales: 0 },
  MRU: { label: 'Ouguiya mauritanien (MRU)', symbole: 'MRU', decimales: 2 },
  MAD: { label: 'Dirham marocain (MAD)', symbole: 'MAD', decimales: 2 },
  GNF: { label: 'Franc guinéen (GNF)', symbole: 'GNF', decimales: 0 },
  EUR: { label: 'Euro (EUR)', symbole: '€', decimales: 2 },
  USD: { label: 'Dollar US (USD)', symbole: '$', decimales: 2 },
}

export const DEVISE_PAR_DEFAUT: DeviseCode = 'XOF'

export function estDeviseValide(v: string | null | undefined): v is DeviseCode {
  return !!v && v in DEVISES
}

export function formatMontant(valeur: number | null | undefined, devise?: string | null): string {
  const code = estDeviseValide(devise) ? devise : DEVISE_PAR_DEFAUT
  const info = DEVISES[code]
  const nombre = Number(valeur ?? 0).toLocaleString('fr-FR', {
    minimumFractionDigits: info.decimales,
    maximumFractionDigits: info.decimales,
  })
  return `${nombre} ${info.symbole}`
}

// Variante sûre pour jsPDF : Number.toLocaleString('fr-FR') groupe les
// milliers avec une espace fine insécable (U+202F) sur les runtimes
// récents, un caractère absent de l'encodage WinAnsi des polices intégrées
// de jsPDF (Helvetica, Times, Courier). jsPDF ne peut alors ni le dessiner
// ni mesurer correctement sa largeur, ce qui fausse le calcul de largeur
// de colonne d'autoTable et peut couper ou chevaucher un montant. Un espace
// ASCII normal produit le même regroupement par milliers sans ce problème
// — à utiliser pour tout montant destiné à un doc.text()/autoTable().
export function formatMontantPdf(valeur: number | null | undefined, devise?: string | null): string {
  const code = estDeviseValide(devise) ? devise : DEVISE_PAR_DEFAUT
  const decimales = DEVISES[code].decimales
  const [entier, partieDecimale] = Number(valeur ?? 0).toFixed(decimales).split('.')
  const entierGroupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return partieDecimale ? `${entierGroupe},${partieDecimale}` : entierGroupe
}
