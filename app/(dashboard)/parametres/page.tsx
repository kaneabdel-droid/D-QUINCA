import { createClient } from '@/utils/supabase/server'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import ParametresForm from './ParametresForm'

export default async function ParametresPage() {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('nom, adresse, telephone, email, identification, devise, logo_url')
    .eq('id', context.entrepriseId)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground mb-2">Paramètres</h1>
      <p className="text-sm text-foreground-muted mb-8">
        Informations de l&apos;entreprise, affichées sur les documents imprimés (factures, tickets, reçus).
      </p>

      <ParametresForm
        entreprise={{
          nom: entreprise?.nom ?? '',
          adresse: entreprise?.adresse ?? '',
          telephone: entreprise?.telephone ?? '',
          email: entreprise?.email ?? '',
          identification: entreprise?.identification ?? '',
          devise: entreprise?.devise ?? 'XOF',
          logoUrl: entreprise?.logo_url ?? null,
        }}
      />
    </div>
  )
}
