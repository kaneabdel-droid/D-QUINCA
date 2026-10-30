import { createClient } from '@/utils/supabase/server'
import { requireGerant, getEntrepriseHeader } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateVenteButton from './CreateVenteButton'
import VentesClientView from './VentesClientView'

export default async function VentesPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; tab?: string }>
}) {
  const context = await requireGerant('/ventes', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.ventes
  const ti = dict.impression
  const { from, to, tab } = (await searchParams) ?? {}
  const entreprise = await getEntrepriseHeader(context.entrepriseId)

  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, unite, prix_vente, categorie_id')
    .eq('actif', true)
    .order('designation')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, nom')
    .eq('entreprise_id', context.entrepriseId)
    .order('nom')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)
    .order('nom')

  let ventesQuery = supabase
    .from('ventes')
    .select(`
      id,
      numero,
      date_vente,
      mode_paiement,
      montant_total,
      montant_paye,
      statut,
      clients(nom),
      lignes_vente(
        id,
        quantite,
        prix_unitaire,
        montant_ligne,
        article_id,
        articles(
          id,
          designation,
          unite,
          reference,
          categorie_id,
          categories(id, nom)
        )
      )
    `)
    .eq('magasin_id', context.magasinId)

  if (from) ventesQuery = ventesQuery.gte('date_vente', from)
  if (to) ventesQuery = ventesQuery.lte('date_vente', `${to}T23:59:59`)

  const { data: ventes } = await ventesQuery
    .order('date_vente', { ascending: false })
    .limit(from || to ? 500 : 100)

  const periodeLabel =
    from || to
      ? `${ti.periode} : ${from ? new Date(from).toLocaleDateString('fr-FR') : '…'} ${ti.au} ${to ? new Date(to).toLocaleDateString('fr-FR') : '…'}`
      : ti.periodeToutes

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">{context.magasinNom}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateVenteButton articles={articles ?? []} clients={clients ?? []} dict={dict} />
        </div>
      </div>

      <VentesClientView
        ventes={(ventes ?? []) as any}
        articles={articles ?? []}
        categories={categories ?? []}
        entreprise={entreprise}
        entrepriseNom={context.entrepriseNom}
        magasinNom={context.magasinNom ?? ''}
        entrepriseDevise={context.entrepriseDevise || 'FCFA'}
        initialFrom={from}
        initialTo={to}
        initialTab={tab}
        dict={dict}
        periodeLabel={periodeLabel}
      />
    </div>
  )
}
