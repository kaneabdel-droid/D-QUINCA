import { createClient } from '@/utils/supabase/server'
import { requireGerant, getEntrepriseHeader } from '@/lib/auth/getCurrentUserContext'
import { formatMontantPdf } from '@/lib/currency'
import { getDictionary, getLocale } from '@/dictionaries'
import ReglerCreanceButton from './ReglerCreanceButton'
import PeriodeFilter from '@/components/PeriodeFilter'
import ImprimerJournalButton from '@/components/ImprimerJournalButton'

export default async function CreancesPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string }>
}) {
  const context = await requireGerant('/creances', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.creances
  const ti = dict.impression
  const c = dict.common
  const { from, to } = (await searchParams) ?? {}
  const entreprise = await getEntrepriseHeader(context.entrepriseId)

  let creancesQuery = supabase
    .from('creances')
    .select('id, montant_initial, montant_restant, date_echeance, statut, clients(nom)')
    .eq('magasin_id', context.magasinId)
  if (from) creancesQuery = creancesQuery.gte('date_echeance', from)
  if (to) creancesQuery = creancesQuery.lte('date_echeance', to)
  const { data: creances } = await creancesQuery
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
  const periodeLabel = from || to ? `${ti.periode} : ${from ? new Date(from).toLocaleDateString('fr-FR') : '…'} ${ti.au} ${to ? new Date(to).toLocaleDateString('fr-FR') : '…'}` : ti.periodeToutes

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {t.totalRestant} <strong className="text-foreground">{totalRestant.toLocaleString('fr-FR')}</strong>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <PeriodeFilter from={from} to={to} dict={dict} />
        <ImprimerJournalButton
          dict={dict}
          entreprise={entreprise}
          magasinNom={context.magasinNom ?? ''}
          titre={t.title}
          periodeLabel={periodeLabel}
          colonnes={[
            { header: t.colClient },
            { header: t.colInitial, align: 'right' },
            { header: t.colRestant, align: 'right' },
            { header: t.colEcheance },
            { header: t.colStatut },
          ]}
          lignes={((creances ?? []) as CreanceRow[]).map((cr) => [
            nomClient(cr.clients) || '-',
            formatMontantPdf(cr.montant_initial, context.entrepriseDevise),
            formatMontantPdf(cr.montant_restant, context.entrepriseDevise),
            cr.date_echeance ? new Date(cr.date_echeance).toLocaleDateString('fr-FR') : '-',
            cr.statut,
          ])}
          nomFichier="journal-creances"
        />
      </div>

      <div className="mt-4 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colClient}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colInitial}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colRestant}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colEcheance}</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">{t.colStatut}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {((creances ?? []) as CreanceRow[]).map((cr) => (
              <tr key={cr.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{nomClient(cr.clients) || '-'}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(cr.montant_initial).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(cr.montant_restant).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{cr.date_echeance ? new Date(cr.date_echeance).toLocaleDateString('fr-FR') : '-'}</td>
                <td className="px-3 py-4 text-sm text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStatut[cr.statut] ?? ''}`}>{cr.statut}</span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {cr.statut !== 'soldee' && (
                    <ReglerCreanceButton creanceId={cr.id} montantRestant={Number(cr.montant_restant)} comptes={comptes ?? []} dict={dict} />
                  )}
                </td>
              </tr>
            ))}
            {(creances ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">{t.empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
