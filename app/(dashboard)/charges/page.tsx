import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import CreateChargeButton from './CreateChargeButton'
import DeleteChargeButton from './DeleteChargeButton'

export default async function ChargesPage() {
  const context = await requireGerant()
  const supabase = await createClient()

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)

  const { data: charges } = await supabase
    .from('charges')
    .select('id, categorie, libelle, montant, date_charge, recurrente')
    .eq('magasin_id', context.magasinId)
    .order('date_charge', { ascending: false })
    .limit(50)

  const totalMois = (charges ?? [])
    .filter((c) => c.date_charge && new Date(c.date_charge).getMonth() === new Date().getMonth())
    .reduce((sum, c) => sum + Number(c.montant), 0)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">Charges</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Ce mois-ci : <strong className="text-foreground">{totalMois.toLocaleString('fr-FR')}</strong>
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateChargeButton comptes={comptes ?? []} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Date</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Catégorie</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Libellé</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Montant</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">Récurrente</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(charges ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {c.date_charge ? new Date(c.date_charge).toLocaleDateString('fr-FR') : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground capitalize">{c.categorie}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{c.libelle || '-'}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(c.montant).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-center">{c.recurrente ? 'Oui' : 'Non'}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <DeleteChargeButton id={c.id} />
                </td>
              </tr>
            ))}
            {(charges ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">Aucune charge</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
