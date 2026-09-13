import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import ReglerCreanceButton from './ReglerCreanceButton'

export default async function CreancesPage() {
  const context = await requireGerant()
  const supabase = await createClient()

  const { data: creances } = await supabase
    .from('creances')
    .select('id, montant_initial, montant_restant, date_echeance, statut, clients(nom)')
    .eq('magasin_id', context.magasinId)
    .order('date_echeance', { ascending: true, nullsFirst: false })

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)

  const totalRestant = (creances ?? []).reduce((sum, c) => sum + Number(c.montant_restant), 0)

  const badgeStatut: Record<string, string> = {
    en_cours: 'bg-warning/10 text-warning',
    soldee: 'bg-success/10 text-success',
    en_retard: 'bg-danger/10 text-danger',
  }

  type CreanceRow = {
    id: string
    montant_initial: number
    montant_restant: number
    date_echeance: string | null
    statut: string
    clients: { nom: string } | { nom: string }[] | null
  }
  const nomClient = (c: CreanceRow['clients']) => (Array.isArray(c) ? c[0]?.nom : c?.nom)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">Créances</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Total restant dû : <strong className="text-foreground">{totalRestant.toLocaleString('fr-FR')}</strong>
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Client</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Initial</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Restant</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Échéance</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">Statut</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {((creances ?? []) as CreanceRow[]).map((c) => (
              <tr key={c.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{nomClient(c.clients) || '-'}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(c.montant_initial).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(c.montant_restant).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{c.date_echeance ? new Date(c.date_echeance).toLocaleDateString('fr-FR') : '-'}</td>
                <td className="px-3 py-4 text-sm text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStatut[c.statut] ?? ''}`}>{c.statut}</span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {c.statut !== 'soldee' && (
                    <ReglerCreanceButton creanceId={c.id} montantRestant={Number(c.montant_restant)} comptes={comptes ?? []} />
                  )}
                </td>
              </tr>
            ))}
            {(creances ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">Aucune créance</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
