'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/utils/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dictionary } from '@/dictionaries'
import type { EntrepriseHeader } from '@/lib/auth/getCurrentUserContext'
import { formatMontantPdf } from '@/lib/currency'
import type { ReleveType } from './ReleveButton'

type Operation = { date: string; libelle: string; debit: number; credit: number }

// Une créance/dette est toujours créée en même temps que la vente/achat qui
// l'a produite (cf. creer_vente/creer_achat, migration 10) et son montant
// initial n'est donc rien d'autre que le reste à payer de cette même
// transaction — l'additionner à la ligne "vente"/"achat" doublerait la dette.
// Seuls les RÈGLEMENTS (paiements postérieurs, journal_tresorerie) sont des
// mouvements distincts à lister ; on les recherche par client_id/fournisseur_id
// direct (pas via les ventes/achats déjà filtrés par période) pour ne pas
// perdre un règlement dont la vente d'origine tombe hors de la période choisie.
async function chargerOperationsClient(
  supabase: SupabaseClient,
  magasinId: string | null,
  clientId: string,
  from: string,
  to: string,
  t: Dictionary['releves']
): Promise<Operation[]> {
  let vq = supabase
    .from('ventes')
    .select('numero, date_vente, montant_total, montant_paye')
    .eq('client_id', clientId)
    .eq('statut', 'validee')
  if (magasinId) vq = vq.eq('magasin_id', magasinId)
  if (from) vq = vq.gte('date_vente', from)
  if (to) vq = vq.lte('date_vente', `${to}T23:59:59`)
  const { data: ventes } = await vq

  let cq = supabase.from('creances').select('id').eq('client_id', clientId)
  if (magasinId) cq = cq.eq('magasin_id', magasinId)
  const { data: creances } = await cq
  const creanceIds = (creances ?? []).map((c) => c.id)

  let reglements: { date_mouvement: string; montant: number }[] = []
  if (creanceIds.length) {
    let rq = supabase
      .from('journal_tresorerie')
      .select('date_mouvement, montant')
      .eq('reference_type', 'creance')
      .in('reference_id', creanceIds)
    if (from) rq = rq.gte('date_mouvement', from)
    if (to) rq = rq.lte('date_mouvement', `${to}T23:59:59`)
    const { data } = await rq
    reglements = data ?? []
  }

  const operations: Operation[] = []
  for (const v of ventes ?? []) {
    operations.push({ date: v.date_vente, libelle: v.numero ? `${t.libelleVente} ${v.numero}` : t.libelleVente, debit: Number(v.montant_total), credit: 0 })
    if (Number(v.montant_paye) > 0) {
      operations.push({ date: v.date_vente, libelle: t.libellePaiementVente, debit: 0, credit: Number(v.montant_paye) })
    }
  }
  for (const r of reglements) {
    operations.push({ date: r.date_mouvement, libelle: t.libelleReglementCreance, debit: 0, credit: Number(r.montant) })
  }
  operations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return operations
}

// Solde du client juste avant "from" (0 si aucune date de début n'est
// choisie, puisqu'alors l'impression couvre déjà tout l'historique) : même
// logique débit/crédit que chargerOperationsClient, mais nettée en un seul
// nombre plutôt que listée opération par opération.
async function calculerSoldeAvantClient(
  supabase: SupabaseClient,
  magasinId: string | null,
  clientId: string,
  from: string
): Promise<number> {
  if (!from) return 0
  let vq = supabase
    .from('ventes')
    .select('montant_total, montant_paye')
    .eq('client_id', clientId)
    .eq('statut', 'validee')
    .lt('date_vente', from)
  if (magasinId) vq = vq.eq('magasin_id', magasinId)
  const { data: ventes } = await vq

  let cq = supabase.from('creances').select('id').eq('client_id', clientId)
  if (magasinId) cq = cq.eq('magasin_id', magasinId)
  const { data: creances } = await cq
  const creanceIds = (creances ?? []).map((c) => c.id)

  let reglements: { montant: number }[] = []
  if (creanceIds.length) {
    const { data } = await supabase
      .from('journal_tresorerie')
      .select('montant')
      .eq('reference_type', 'creance')
      .in('reference_id', creanceIds)
      .lt('date_mouvement', from)
    reglements = data ?? []
  }

  let solde = 0
  for (const v of ventes ?? []) solde += Number(v.montant_total) - Number(v.montant_paye)
  for (const r of reglements) solde -= Number(r.montant)
  return solde
}

async function chargerOperationsFournisseur(
  supabase: SupabaseClient,
  magasinId: string | null,
  fournisseurId: string,
  from: string,
  to: string,
  t: Dictionary['releves']
): Promise<Operation[]> {
  let aq = supabase
    .from('achats')
    .select('numero, date_achat, montant_total, montant_paye')
    .eq('fournisseur_id', fournisseurId)
    .eq('statut', 'validee')
  if (magasinId) aq = aq.eq('magasin_id', magasinId)
  if (from) aq = aq.gte('date_achat', from)
  if (to) aq = aq.lte('date_achat', `${to}T23:59:59`)
  const { data: achats } = await aq

  let dq = supabase.from('dettes').select('id').eq('fournisseur_id', fournisseurId)
  if (magasinId) dq = dq.eq('magasin_id', magasinId)
  const { data: dettes } = await dq
  const detteIds = (dettes ?? []).map((d) => d.id)

  let reglements: { date_mouvement: string; montant: number }[] = []
  if (detteIds.length) {
    let rq = supabase
      .from('journal_tresorerie')
      .select('date_mouvement, montant')
      .eq('reference_type', 'dette')
      .in('reference_id', detteIds)
    if (from) rq = rq.gte('date_mouvement', from)
    if (to) rq = rq.lte('date_mouvement', `${to}T23:59:59`)
    const { data } = await rq
    reglements = data ?? []
  }

  const operations: Operation[] = []
  for (const a of achats ?? []) {
    operations.push({ date: a.date_achat, libelle: a.numero ? `${t.libelleAchat} ${a.numero}` : t.libelleAchat, debit: 0, credit: Number(a.montant_total) })
    if (Number(a.montant_paye) > 0) {
      operations.push({ date: a.date_achat, libelle: t.libellePaiementAchat, debit: Number(a.montant_paye), credit: 0 })
    }
  }
  for (const r of reglements) {
    operations.push({ date: r.date_mouvement, libelle: t.libelleReglementDette, debit: Number(r.montant), credit: 0 })
  }
  operations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return operations
}

async function calculerSoldeAvantFournisseur(
  supabase: SupabaseClient,
  magasinId: string | null,
  fournisseurId: string,
  from: string
): Promise<number> {
  if (!from) return 0
  let aq = supabase
    .from('achats')
    .select('montant_total, montant_paye')
    .eq('fournisseur_id', fournisseurId)
    .eq('statut', 'validee')
    .lt('date_achat', from)
  if (magasinId) aq = aq.eq('magasin_id', magasinId)
  const { data: achats } = await aq

  let dq = supabase.from('dettes').select('id').eq('fournisseur_id', fournisseurId)
  if (magasinId) dq = dq.eq('magasin_id', magasinId)
  const { data: dettes } = await dq
  const detteIds = (dettes ?? []).map((d) => d.id)

  let reglements: { montant: number }[] = []
  if (detteIds.length) {
    const { data } = await supabase
      .from('journal_tresorerie')
      .select('montant')
      .eq('reference_type', 'dette')
      .in('reference_id', detteIds)
      .lt('date_mouvement', from)
    reglements = data ?? []
  }

  let solde = 0
  for (const a of achats ?? []) solde += Number(a.montant_total) - Number(a.montant_paye)
  for (const r of reglements) solde -= Number(r.montant)
  return solde
}

export default function ReleveModal({
  onClose,
  releveType,
  magasinId,
  entreprise,
  devise,
  referenceId,
  referenceNom,
  dict,
}: {
  onClose: () => void
  releveType: ReleveType
  magasinId: string | null
  entreprise: EntrepriseHeader
  devise: string
  referenceId: string
  referenceNom: string
  dict: Dictionary
}) {
  const t = dict.releves
  const ti = dict.impression
  const c = dict.common
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const genererPdf = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const [operations, soldeAvant] =
        releveType === 'client'
          ? await Promise.all([
              chargerOperationsClient(supabase, magasinId, referenceId, from, to, t),
              calculerSoldeAvantClient(supabase, magasinId, referenceId, from),
            ])
          : await Promise.all([
              chargerOperationsFournisseur(supabase, magasinId, referenceId, from, to, t),
              calculerSoldeAvantFournisseur(supabase, magasinId, referenceId, from),
            ])

      const doc = new jsPDF({ orientation })
      const pageWidth = doc.internal.pageSize.getWidth()
      const titre = releveType === 'client' ? t.titleClient : t.titleFournisseur

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(30, 86, 49)
      doc.text(entreprise.nom || '-', 14, 18)

      let y = 24
      const infos = [entreprise.adresse, entreprise.telephone, entreprise.identification].filter(Boolean)
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
      doc.text(`${titre} — ${referenceNom}`, 14, y + 6)

      const periodeLabel = from || to
        ? `${ti.periode} : ${from ? new Date(from).toLocaleDateString('fr-FR') : '…'} ${ti.au} ${to ? new Date(to).toLocaleDateString('fr-FR') : '…'}`
        : ti.periodeToutes
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120, 120, 120)
      doc.text(periodeLabel, 14, y + 12)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`${t.soldeInitial} : ${formatMontantPdf(soldeAvant, devise)}`, pageWidth - 14, y + 12, { align: 'right' })

      doc.setDrawColor(30, 86, 49)
      doc.line(14, y + 16, pageWidth - 14, y + 16)

      const totalDebit = operations.reduce((s, o) => s + o.debit, 0)
      const totalCredit = operations.reduce((s, o) => s + o.credit, 0)

      autoTable(doc, {
        startY: y + 22,
        margin: { left: 14, right: 14 },
        head: [[t.colDate, t.colLibelle, t.colDebit, t.colCredit]],
        body: operations.map((o) => [
          new Date(o.date).toLocaleDateString('fr-FR'),
          o.libelle,
          o.debit > 0 ? formatMontantPdf(o.debit, devise) : '',
          o.credit > 0 ? formatMontantPdf(o.credit, devise) : '',
        ]),
        // Ligne de total : cellule "libellé" vide plutôt que d'y concaténer les
        // deux intitulés — les montants sont déjà sans ambiguïté sous leur
        // propre colonne, et une cellule vide n'entre jamais en concurrence
        // avec les colonnes Débit/Crédit pour la largeur disponible.
        foot: [['', '', formatMontantPdf(totalDebit, devise), formatMontantPdf(totalCredit, devise)]],
        theme: 'striped',
        headStyles: { fillColor: [30, 86, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
        // Largeurs fixes et généreuses pour Date/Débit/Crédit (calculées pour
        // le plus grand montant réaliste, ex. "12 345 678") afin qu'un montant
        // ne puisse jamais se retrouver coupé sur deux lignes ; seule la
        // colonne Libellé (texte variable) reste flexible ('auto').
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 34, halign: 'right' },
          3: { cellWidth: 34, halign: 'right' },
        },
      })

      const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30, 86, 49)
      doc.text(`${t.soldeFinal} : ${formatMontantPdf(soldeAvant + totalDebit - totalCredit, devise)}`, pageWidth - 14, finalY + 10, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(160, 160, 160)
      doc.text(`${ti.imprimeLe} ${new Date().toLocaleString('fr-FR')}`, 14, doc.internal.pageSize.getHeight() - 8)

      doc.save(`${titre.replace(/ /g, '_')}_${referenceNom.replace(/ /g, '_')}.pdf`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-surface-border">
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 sm:px-6">
            <h3 className="text-lg font-semibold text-foreground">{releveType === 'client' ? t.titleClient : t.titleFournisseur}</h3>
            <button onClick={onClose} className="rounded-md p-1 text-foreground-muted hover:bg-background hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-4 sm:px-6 space-y-4">
            <p className="text-sm text-foreground-muted">{referenceNom}</p>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground">{ti.du}</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{ti.au}</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">{c.select}</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
              >
                <option value="portrait">{ti.portrait}</option>
                <option value="landscape">{ti.paysage}</option>
              </select>
            </div>
          </div>

          <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              onClick={genererPdf}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {ti.imprimer}
            </button>
            <button
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background sm:mt-0 sm:w-auto"
            >
              {c.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
