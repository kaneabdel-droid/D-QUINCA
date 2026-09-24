import Link from 'next/link'
import FitAmount from './FitAmount'
import { createClient } from '@/utils/supabase/server'
import { requireGerantOuTresorier, getEntrepriseHeader } from '@/lib/auth/getCurrentUserContext'
import { formatMontantPdf } from '@/lib/currency'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateCompteButton from './CreateCompteButton'
import AddEcritureButton from './AddEcritureButton'
import EcritureRowActions from './EcritureRowActions'
import PeriodeFilter from '@/components/PeriodeFilter'
import ImprimerJournalButton from '@/components/ImprimerJournalButton'

function formatDateJJMMAAAA(iso: string) {
  const d = new Date(iso)
  const jj = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${jj}/${mm}/${d.getFullYear()}`
}

export default async function TresoreriePage({
  searchParams,
}: {
  searchParams?: Promise<{ compte?: string; from?: string; to?: string }>
}) {
  const context = await requireGerantOuTresorier('/tresorerie', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.tresorerie
  const ti = dict.impression
  const c = dict.common
  const { compte: compteFiltreId, from, to } = (await searchParams) ?? {}
  const entreprise = await getEntrepriseHeader(context.entrepriseId)

  // Préserve les autres filtres actifs (compte, période) quand on change l'un
  // d'eux — sans ça, cliquer un compte perdrait la période choisie et
  // inversement.
  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const valeurs = { compte: compteFiltreId, from, to, ...overrides }
    for (const [cle, valeur] of Object.entries(valeurs)) {
      if (valeur) params.set(cle, valeur)
    }
    const s = params.toString()
    return s ? `?${s}` : '?'
  }

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('id, nom, type_compte, solde_initial')
    .eq('magasin_id', context.magasinId)
    .order('nom')

  let mouvementsQuery = supabase
    .from('journal_tresorerie')
    .select('id, compte_tresorerie_id, type_mouvement, montant, categorie, motif, date_mouvement, reference_id, reference_type')
    .eq('magasin_id', context.magasinId)
  if (compteFiltreId) mouvementsQuery = mouvementsQuery.eq('compte_tresorerie_id', compteFiltreId)
  if (from) mouvementsQuery = mouvementsQuery.gte('date_mouvement', from)
  if (to) mouvementsQuery = mouvementsQuery.lte('date_mouvement', `${to}T23:59:59`)
  const { data: mouvements } = await mouvementsQuery
    .order('date_mouvement', { ascending: false })
    .limit(50)

  // Soldes des comptes calculés à partir d'une requête séparée, non filtrée
  // par compte/période : sinon, filtrer le journal sur un compte ou une
  // période viderait à tort le solde affiché sur les cartes des AUTRES
  // comptes (ou sur une période qui exclut leurs mouvements).
  const { data: mouvementsPourSolde } = await supabase
    .from('journal_tresorerie')
    .select('compte_tresorerie_id, type_mouvement, montant')
    .eq('magasin_id', context.magasinId)
    .order('date_mouvement', { ascending: false })
    .limit(50)

  const soldeParCompte = new Map<string, number>()
  for (const c of comptes ?? []) soldeParCompte.set(c.id, Number(c.solde_initial))
  for (const m of mouvementsPourSolde ?? []) {
    const courant = soldeParCompte.get(m.compte_tresorerie_id) ?? 0
    soldeParCompte.set(m.compte_tresorerie_id, courant + (m.type_mouvement === 'entree' ? Number(m.montant) : -Number(m.montant)))
  }
  const compteParId = new Map((comptes ?? []).map((c) => [c.id, c]))
  const compteFiltre = compteFiltreId ? compteParId.get(compteFiltreId) : undefined

  // Solde initial/final de l'impression : les comptes concernés sont soit le
  // seul compte filtré, soit tous les comptes du magasin quand aucun filtre
  // n'est actif. Le solde initial part du solde_initial de ces comptes et
  // ajoute tous LEURS mouvements antérieurs à "from" (sans la limite de 50
  // lignes de l'affichage, pour rester exact même au-delà) ; le solde final
  // y ajoute ensuite le mouvement net de la période imprimée.
  const comptesInclus = compteFiltre ? [compteFiltre] : (comptes ?? [])
  const comptesInclusIds = comptesInclus.map((cpt) => cpt.id)
  let soldeInitialPeriode = comptesInclus.reduce((s, cpt) => s + Number(cpt.solde_initial), 0)
  if (from && comptesInclusIds.length) {
    const { data: mouvementsAvant } = await supabase
      .from('journal_tresorerie')
      .select('type_mouvement, montant')
      .eq('magasin_id', context.magasinId)
      .in('compte_tresorerie_id', comptesInclusIds)
      .lt('date_mouvement', from)
    for (const m of mouvementsAvant ?? []) {
      soldeInitialPeriode += m.type_mouvement === 'entree' ? Number(m.montant) : -Number(m.montant)
    }
  }
  let totalDebitPeriode = 0
  let totalCreditPeriode = 0
  if (comptesInclusIds.length) {
    let netQuery = supabase
      .from('journal_tresorerie')
      .select('type_mouvement, montant')
      .eq('magasin_id', context.magasinId)
      .in('compte_tresorerie_id', comptesInclusIds)
    if (from) netQuery = netQuery.gte('date_mouvement', from)
    if (to) netQuery = netQuery.lte('date_mouvement', `${to}T23:59:59`)
    const { data: mouvementsNetPeriode } = await netQuery
    for (const m of mouvementsNetPeriode ?? []) {
      if (m.type_mouvement === 'entree') totalDebitPeriode += Number(m.montant)
      else totalCreditPeriode += Number(m.montant)
    }
  }
  const soldeFinalPeriode = soldeInitialPeriode + totalDebitPeriode - totalCreditPeriode

  // reference_id/reference_type est une référence polymorphe (vente, achat,
  // créance, dette) — PostgREST ne peut pas l'embarquer automatiquement, d'où
  // ces requêtes de résolution manuelles pour retrouver le tiers (client ou
  // fournisseur) de chaque écriture liée.
  const idsParType = { vente: new Set<string>(), achat: new Set<string>(), creance: new Set<string>(), dette: new Set<string>() }
  for (const m of mouvements ?? []) {
    if (m.reference_id && m.reference_type && m.reference_type in idsParType) {
      idsParType[m.reference_type as keyof typeof idsParType].add(m.reference_id)
    }
  }

  const [{ data: ventesData }, { data: achatsData }, { data: creancesData }, { data: dettesData }] = await Promise.all([
    idsParType.vente.size ? supabase.from('ventes').select('id, client_id').in('id', [...idsParType.vente]) : Promise.resolve({ data: [] as { id: string; client_id: string | null }[] }),
    idsParType.achat.size ? supabase.from('achats').select('id, fournisseur_id').in('id', [...idsParType.achat]) : Promise.resolve({ data: [] as { id: string; fournisseur_id: string | null }[] }),
    idsParType.creance.size ? supabase.from('creances').select('id, client_id').in('id', [...idsParType.creance]) : Promise.resolve({ data: [] as { id: string; client_id: string | null }[] }),
    idsParType.dette.size ? supabase.from('dettes').select('id, fournisseur_id').in('id', [...idsParType.dette]) : Promise.resolve({ data: [] as { id: string; fournisseur_id: string | null }[] }),
  ])

  const clientIdParVenteId = new Map((ventesData ?? []).map((v) => [v.id, v.client_id]))
  const fournisseurIdParAchatId = new Map((achatsData ?? []).map((a) => [a.id, a.fournisseur_id]))
  const clientIdParCreanceId = new Map((creancesData ?? []).map((cr) => [cr.id, cr.client_id]))
  const fournisseurIdParDetteId = new Map((dettesData ?? []).map((d) => [d.id, d.fournisseur_id]))

  const clientIds = new Set([...clientIdParVenteId.values(), ...clientIdParCreanceId.values()].filter((id): id is string => !!id))
  const fournisseurIds = new Set([...fournisseurIdParAchatId.values(), ...fournisseurIdParDetteId.values()].filter((id): id is string => !!id))

  const [{ data: clientsData }, { data: fournisseursData }] = await Promise.all([
    clientIds.size ? supabase.from('clients').select('id, nom').in('id', [...clientIds]) : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
    fournisseurIds.size ? supabase.from('fournisseurs').select('id, nom').in('id', [...fournisseurIds]) : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
  ])

  const clientNomParId = new Map((clientsData ?? []).map((cl) => [cl.id, cl.nom]))
  const fournisseurNomParId = new Map((fournisseursData ?? []).map((f) => [f.id, f.nom]))

  function tiersPour(m: { reference_id: string | null; reference_type: string | null }): string {
    if (!m.reference_id || !m.reference_type) return '-'
    if (m.reference_type === 'vente') {
      const clientId = clientIdParVenteId.get(m.reference_id)
      return (clientId && clientNomParId.get(clientId)) || '-'
    }
    if (m.reference_type === 'achat') {
      const fournisseurId = fournisseurIdParAchatId.get(m.reference_id)
      return (fournisseurId && fournisseurNomParId.get(fournisseurId)) || '-'
    }
    if (m.reference_type === 'creance') {
      const clientId = clientIdParCreanceId.get(m.reference_id)
      return (clientId && clientNomParId.get(clientId)) || '-'
    }
    if (m.reference_type === 'dette') {
      const fournisseurId = fournisseurIdParDetteId.get(m.reference_id)
      return (fournisseurId && fournisseurNomParId.get(fournisseurId)) || '-'
    }
    return '-'
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">{context.magasinNom}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex gap-2">
          <CreateCompteButton dict={dict} />
          <AddEcritureButton comptes={comptes ?? []} dict={dict} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {(comptes ?? []).map((compte) => {
          const estSelectionne = compte.id === compteFiltreId
          return (
            <Link
              key={compte.id}
              href={qs({ compte: estSelectionne ? undefined : compte.id })}
              className={`block min-w-0 rounded-lg bg-surface px-3 py-2 shadow-sm border transition-colors ${estSelectionne ? 'border-primary ring-2 ring-primary/30' : 'border-surface-border hover:border-primary/50'}`}
            >
              <p className="text-xs font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">{compte.nom}</p>
              <p className="text-[10px] capitalize leading-tight text-foreground-muted">{compte.type_compte.replace('_', ' ')}</p>
              <FitAmount className="mt-1 font-bold leading-tight text-foreground">
                {(compteFiltreId && !estSelectionne ? 0 : (soldeParCompte.get(compte.id) ?? 0)).toLocaleString('fr-FR')}
              </FitAmount>
            </Link>
          )
        })}
        {(comptes ?? []).length === 0 && (
          <p className="text-sm text-foreground-muted col-span-full">{t.emptyComptes}</p>
        )}
      </div>

      <div className="mt-10 mb-4 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          {t.journal}
          {compteFiltre && (
            <span className="ml-2 text-sm font-normal text-foreground-muted">
              — {compteFiltre.nom} · {t.soldeCompteFiltre} : {(soldeParCompte.get(compteFiltre.id) ?? 0).toLocaleString('fr-FR')}
            </span>
          )}
        </h3>
        {compteFiltre && (
          <Link href={qs({ compte: undefined })} className="text-sm font-medium text-primary hover:underline">{t.toutesComptes}</Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PeriodeFilter from={from} to={to} dict={dict} hiddenParams={compteFiltreId ? { compte: compteFiltreId } : undefined} />
        <ImprimerJournalButton
          dict={dict}
          entreprise={entreprise}
          magasinNom={context.magasinNom ?? ''}
          titre={compteFiltre ? `${t.journal} — ${compteFiltre.nom}` : t.journal}
          periodeLabel={from || to ? `${ti.periode} : ${from ? new Date(from).toLocaleDateString('fr-FR') : '…'} ${ti.au} ${to ? new Date(to).toLocaleDateString('fr-FR') : '…'}` : ti.periodeToutes}
          soldeInitial={formatMontantPdf(soldeInitialPeriode, context.entrepriseDevise)}
          totalDebit={formatMontantPdf(totalDebitPeriode, context.entrepriseDevise)}
          totalCredit={formatMontantPdf(totalCreditPeriode, context.entrepriseDevise)}
          soldeFinal={formatMontantPdf(soldeFinalPeriode, context.entrepriseDevise)}
          colonnes={[
            { header: t.colDate },
            { header: t.colCompte },
            { header: t.colCategorie },
            { header: t.colTiers },
            { header: t.colMotif },
            { header: t.colMontant, align: 'right' },
          ]}
          lignes={(mouvements ?? []).map((m) => [
            m.date_mouvement ? formatDateJJMMAAAA(m.date_mouvement) : '-',
            compteParId.get(m.compte_tresorerie_id)?.nom ?? '-',
            (m.categorie ?? '-').replace('_', ' '),
            tiersPour(m),
            m.motif || '-',
            `${m.type_mouvement === 'entree' ? '+' : '-'}${formatMontantPdf(m.montant, context.entrepriseDevise)}`,
          ])}
          nomFichier="journal-tresorerie"
        />
      </div>

      <div className="overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colDate}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colCompte}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colCategorie}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colTiers}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colMotif}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colMontant}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(mouvements ?? []).map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {m.date_mouvement ? formatDateJJMMAAAA(m.date_mouvement) : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground">{compteParId.get(m.compte_tresorerie_id)?.nom ?? '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted capitalize">{(m.categorie ?? '-').replace('_', ' ')}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{tiersPour(m)}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{m.motif || '-'}</td>
                <td className={`px-3 py-4 text-sm text-right font-medium ${m.type_mouvement === 'entree' ? 'text-success' : 'text-danger'}`}>
                  {m.type_mouvement === 'entree' ? '+' : '-'}{Number(m.montant).toLocaleString('fr-FR')}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {m.reference_type ? (
                    <span className="text-xs text-foreground-muted">{t.origines[m.reference_type as keyof typeof t.origines] ?? t.linkedNotice}</span>
                  ) : (
                    <EcritureRowActions ecriture={m} comptes={comptes ?? []} dict={dict} />
                  )}
                </td>
              </tr>
            ))}
            {(mouvements ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-foreground-muted">{t.emptyMouvements}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
