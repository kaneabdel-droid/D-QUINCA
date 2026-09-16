'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/utils/supabase/client'

const formatMontant = (n: number | undefined | null) =>
  Math.round(n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

type Vente = {
  id: string
  numero: string | null
  date_vente: string | null
  mode_paiement: string | null
  montant_total: number
  montant_paye: number
}

type LigneVente = {
  quantite: number
  prix_unitaire: number
  montant_ligne: number
  articles: { designation: string; unite: string } | { designation: string; unite: string }[] | null
}

type JsPDFAvecAutoTable = InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }

export default function ReceiptPdfButton({ vente, entrepriseNom, magasinNom, clientNom, title }: {
  vente: Vente
  entrepriseNom: string
  magasinNom: string
  clientNom: string | null
  title?: string
}) {
  const [loading, setLoading] = useState(false)

  const generatePdf = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: lignes } = await supabase
        .from('lignes_vente')
        .select('quantite, prix_unitaire, montant_ligne, articles(designation, unite)')
        .eq('vente_id', vente.id)

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(30, 86, 49)
      doc.text(entrepriseNom, 14, 20)

      doc.setFontSize(11)
      doc.setTextColor(120, 120, 120)
      doc.text(magasinNom, 14, 27)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(200, 200, 200)
      doc.text('REÇU DE VENTE', pageWidth - 14, 20, { align: 'right' })

      doc.setDrawColor(30, 86, 49)
      doc.line(14, 32, pageWidth - 14, 32)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`N° : ${vente.id.substring(0, 8).toUpperCase()}`, 14, 40)
      doc.text(`Date : ${vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}`, 14, 45)
      doc.text(`Client : ${clientNom || 'Client de passage'}`, 14, 50)
      doc.text(`Mode de paiement : ${vente.mode_paiement || '-'}`, 14, 55)

      const body = ((lignes ?? []) as LigneVente[]).map((l) => {
        const article = Array.isArray(l.articles) ? l.articles[0] : l.articles
        return [
          `${article?.designation ?? '-'} (${article?.unite ?? ''})`,
          String(l.quantite),
          formatMontant(l.prix_unitaire),
          formatMontant(l.montant_ligne),
        ]
      })

      autoTable(doc, {
        startY: 62,
        head: [['Article', 'Qté', 'Prix unit.', 'Montant']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [30, 86, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'right', cellWidth: 35 },
          3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      })

      const finalY = (doc as JsPDFAvecAutoTable).lastAutoTable?.finalY ?? 100
      const resteAPayer = Number(vente.montant_total) - Number(vente.montant_paye)

      let ty = finalY + 10
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text('Total :', pageWidth - 70, ty)
      doc.text(`${formatMontant(vente.montant_total)}`, pageWidth - 14, ty, { align: 'right' })
      ty += 6
      doc.text('Payé :', pageWidth - 70, ty)
      doc.text(`${formatMontant(vente.montant_paye)}`, pageWidth - 14, ty, { align: 'right' })
      ty += 8
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(resteAPayer > 0 ? 220 : 30, resteAPayer > 0 ? 38 : 86, resteAPayer > 0 ? 38 : 49)
      doc.text(resteAPayer > 0 ? 'RESTE À PAYER :' : 'SOLDÉ', pageWidth - 70, ty)
      if (resteAPayer > 0) doc.text(`${formatMontant(resteAPayer)}`, pageWidth - 14, ty, { align: 'right' })

      doc.save(`Recu_${vente.id.substring(0, 8)}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={generatePdf} disabled={loading} className="text-foreground-muted hover:text-primary p-1 disabled:opacity-50" title={title ?? 'Télécharger le reçu'}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  )
}
