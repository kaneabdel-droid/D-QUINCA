'use client'

import { useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Dictionary } from '@/dictionaries'

type Entreprise = { nom: string; adresse: string | null; telephone: string | null; identification: string | null }
type Colonne = { header: string; align?: 'left' | 'right' | 'center' }

// Impression au format A4 (portrait ou paysage, au choix) via jsPDF, réutilisé
// à l'identique sur les journaux de charges, créances, dettes, ventes, achats
// et trésorerie — seules les colonnes/lignes/titre changent par page. Le PDF
// généré se télécharge puis s'imprime via la boîte de dialogue d'impression
// du navigateur, ce qui couvre n'importe quelle imprimante déjà installée
// côté système (thermique ticket comme A4 classique), sans dépendre d'un
// pilote ou d'une intégration matérielle spécifique.
export default function ImprimerJournalButton({
  dict,
  entreprise,
  magasinNom,
  titre,
  periodeLabel,
  soldeInitial,
  soldeFinal,
  colonnes,
  lignes,
  totalLigne,
  nomFichier,
}: {
  dict: Dictionary
  entreprise: Entreprise
  magasinNom: string
  titre: string
  periodeLabel?: string
  // Uniquement pertinent pour un journal adossé à un solde réel (trésorerie) —
  // les autres journaux (charges, ventes, achats, créances, dettes) n'ont pas
  // de notion de solde et laissent ces deux props non renseignées.
  soldeInitial?: string
  soldeFinal?: string
  colonnes: Colonne[]
  lignes: (string | number)[][]
  totalLigne?: (string | number)[]
  nomFichier: string
}) {
  const t = dict.impression
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [loading, setLoading] = useState(false)

  const imprimer = (orientation: 'portrait' | 'landscape') => {
    setMenuOuvert(false)
    setLoading(true)
    try {
      const doc = new jsPDF({ orientation })
      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(30, 86, 49)
      doc.text(entreprise.nom || '-', 14, 18)

      let y = 24
      const infos = [magasinNom, entreprise.adresse, entreprise.telephone, entreprise.identification].filter(Boolean)
      if (infos.length) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text(infos.join('   ·   '), 14, y)
        y += 6
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(40, 40, 40)
      doc.text(titre, 14, y + 6)

      if (periodeLabel) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text(periodeLabel, 14, y + 12)
        y += 6
      }

      if (soldeInitial) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        doc.text(`${t.soldeInitial} : ${soldeInitial}`, pageWidth - 14, y + 6, { align: 'right' })
      }

      doc.setDrawColor(30, 86, 49)
      doc.line(14, y + 10, pageWidth - 14, y + 10)

      autoTable(doc, {
        startY: y + 16,
        margin: { left: 14, right: 14 },
        head: [colonnes.map((col) => col.header)],
        body: lignes,
        foot: totalLigne ? [totalLigne] : undefined,
        theme: 'striped',
        headStyles: { fillColor: [30, 86, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
        // Une colonne alignée à droite est, par convention dans cet appelant,
        // toujours un montant : lui donner une largeur fixe et généreuse (au
        // lieu de laisser autoTable la dimensionner selon son contenu) évite
        // qu'elle ne devienne trop étroite et ne force un montant à se couper
        // sur deux lignes — seules les colonnes de texte libre restent 'auto'.
        columnStyles: colonnes.reduce<Record<number, { halign?: 'left' | 'right' | 'center'; cellWidth?: number }>>((acc, col, i) => {
          if (col.align) acc[i] = { halign: col.align, ...(col.align === 'right' ? { cellWidth: 32 } : {}) }
          return acc
        }, {}),
      })

      if (soldeFinal) {
        const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(30, 86, 49)
        doc.text(`${t.soldeFinal} : ${soldeFinal}`, pageWidth - 14, finalY + 10, { align: 'right' })
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(160, 160, 160)
      doc.text(`${t.imprimeLe} ${new Date().toLocaleString('fr-FR')}`, 14, doc.internal.pageSize.getHeight() - 8)

      doc.save(`${nomFichier}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOuvert((v) => !v)}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-surface border border-surface-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {t.imprimer}
      </button>
      {menuOuvert && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-surface-border bg-background shadow-xl z-20 py-1">
          <button onClick={() => imprimer('portrait')} className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface">
            {t.portrait}
          </button>
          <button onClick={() => imprimer('landscape')} className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface">
            {t.paysage}
          </button>
        </div>
      )}
    </div>
  )
}
