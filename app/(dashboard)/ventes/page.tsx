import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import CreateVenteButton from './CreateVenteButton'
import ReceiptPdfButton from './ReceiptPdfButton'

export default async function VentesPage() {
  const context = await requireGerant()
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, unite, prix_vente')
    .eq('actif', true)
    .order('designation')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)
    .order('nom')

  const { data: ventes } = await supabase
    .from('ventes')
    .select('id, numero, date_vente, mode_paiement, montant_total, montant_paye, statut, clients(nom)')
    .eq('magasin_id', context.magasinId)
    .order('date_vente', { ascending: false })
    .limit(50)

  const badgeStatut: Record<string, string> = {
    validee: 'bg-success/10 text-success',
    brouillon: 'bg-warning/10 text-warning',
    annulee: 'bg-danger/10 text-danger',
  }

  type VenteRow = {
    id: string
    numero: string | null
    date_vente: string | null
    mode_paiement: string | null
    montant_total: number
    montant_paye: number
    statut: string
    clients: { nom: string } | { nom: string }[] | null
  }
  const nomClient = (c: VenteRow['clients']) => (Array.isArray(c) ? c[0]?.nom : c?.nom)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">Ventes</h2>
          <p className="mt-2 text-sm text-foreground-muted">{context.magasinNom}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateVenteButton articles={articles ?? []} clients={clients ?? []} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Date</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Client</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Paiement</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Total</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Payé</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">Statut</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {((ventes ?? []) as VenteRow[]).map((vente) => (
              <tr key={vente.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground">{nomClient(vente.clients) || 'Client de passage'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted capitalize">{vente.mode_paiement}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(vente.montant_total).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(vente.montant_paye).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStatut[vente.statut] ?? ''}`}>
                    {vente.statut}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <ReceiptPdfButton
                    vente={vente}
                    entrepriseNom={context.entrepriseNom}
                    magasinNom={context.magasinNom ?? ''}
                    clientNom={nomClient(vente.clients) ?? null}
                  />
                </td>
              </tr>
            ))}
            {(ventes ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-foreground-muted">Aucune vente</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
