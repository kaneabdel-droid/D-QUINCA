import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import CreateClientButton from './CreateClientButton'
import DeleteClientButton from './DeleteClientButton'

export default async function ClientsPage() {
  const context = await requireGerant()
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, nom, telephone, adresse')
    .eq('magasin_id', context.magasinId)
    .order('nom')

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">Clients</h2>
          <p className="mt-2 text-sm text-foreground-muted">{context.magasinNom}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateClientButton />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Nom</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Téléphone</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Adresse</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(clients ?? []).map((client) => (
              <tr key={client.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{client.nom}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{client.telephone || '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{client.adresse || '-'}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <DeleteClientButton id={client.id} nom={client.nom} />
                </td>
              </tr>
            ))}
            {(clients ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-foreground-muted">Aucun client</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
