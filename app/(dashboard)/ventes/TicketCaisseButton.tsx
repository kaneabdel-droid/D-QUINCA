'use client'

import { useState } from 'react'
import { Receipt, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { Dictionary } from '@/dictionaries'

const formatMontant = (n: number | undefined | null) =>
  Math.round(n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

type Vente = {
  id: string
  date_vente: string | null
  montant_total: number
  montant_paye: number
}

type LigneVente = {
  quantite: number
  prix_unitaire: number
  montant_ligne: number
  articles: { designation: string; unite: string } | { designation: string; unite: string }[] | null
}

function echapperHtml(texte: string) {
  return texte.replace(/[&<>"']/g, (car) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[car] as string))
}

// Ticket de caisse au format rouleau (80mm, hauteur automatique) plutôt qu'un
// PDF A4 : `@page { size: 80mm auto }` fait tenir le contenu sur sa propre
// hauteur sans page blanche derrière, ce que jsPDF (hauteur de page fixée à
// l'avance) ne permet pas. Imprimé via window.print() dans une fenêtre à part,
// donc via la boîte de dialogue d'impression du système — fonctionne avec
// n'importe quelle imprimante déjà installée (thermique ticket ou classique),
// sans intégration pilote spécifique.
export default function TicketCaisseButton({
  vente,
  entrepriseNom,
  magasinNom,
  clientNom,
  dict,
  title,
}: {
  vente: Vente
  entrepriseNom: string
  magasinNom: string
  clientNom: string | null
  dict: Dictionary
  title?: string
}) {
  const t = dict.impression
  const [loading, setLoading] = useState(false)

  const imprimerTicket = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: lignes } = await supabase
        .from('lignes_vente')
        .select('quantite, prix_unitaire, montant_ligne, articles(designation, unite)')
        .eq('vente_id', vente.id)

      const lignesHtml = ((lignes ?? []) as LigneVente[])
        .map((l) => {
          const article = Array.isArray(l.articles) ? l.articles[0] : l.articles
          return `<div class="ligne">
            <div>${echapperHtml(article?.designation ?? '-')}</div>
            <div class="detail"><span>${l.quantite} x ${formatMontant(l.prix_unitaire)}</span><span>${formatMontant(l.montant_ligne)}</span></div>
          </div>`
        })
        .join('')

      const resteAPayer = Number(vente.montant_total) - Number(vente.montant_paye)

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 80mm; margin: 0; padding: 4mm; }
  .centre { text-align: center; }
  .nom { font-size: 14px; font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .ligne { margin-bottom: 3px; }
  .detail { display: flex; justify-content: space-between; gap: 4px; }
  .detail span { white-space: nowrap; }
  .totaux div { display: flex; justify-content: space-between; margin-top: 2px; }
  .totaux span { white-space: nowrap; }
  .grand { font-weight: bold; font-size: 13px; }
</style>
</head>
<body>
  <div class="centre nom">${echapperHtml(entrepriseNom)}</div>
  <div class="centre">${echapperHtml(magasinNom)}</div>
  <hr />
  <div>${t.ticketNumero} : ${vente.id.substring(0, 8).toUpperCase()}</div>
  <div>${t.ticketDate} : ${vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}</div>
  <div>${t.ticketClient} : ${echapperHtml(clientNom || '-')}</div>
  <hr />
  ${lignesHtml}
  <hr />
  <div class="totaux">
    <div><span>${t.ticketTotal}</span><span>${formatMontant(vente.montant_total)}</span></div>
    <div><span>${t.ticketPaye}</span><span>${formatMontant(vente.montant_paye)}</span></div>
    <div class="grand"><span>${resteAPayer > 0 ? t.ticketReste : t.ticketSolde}</span><span>${resteAPayer > 0 ? formatMontant(resteAPayer) : ''}</span></div>
  </div>
  <hr />
  <div class="centre">${echapperHtml(t.ticketMerci)}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`

      const fenetre = window.open('', '_blank', 'width=400,height=600')
      if (fenetre) {
        fenetre.document.open()
        fenetre.document.write(html)
        fenetre.document.close()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={imprimerTicket}
      disabled={loading}
      className="text-foreground-muted hover:text-primary p-1 disabled:opacity-50"
      title={title ?? t.imprimerTicket}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
    </button>
  )
}
