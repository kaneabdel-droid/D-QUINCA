import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { AlertTriangle } from 'lucide-react'
import AjustementStockButton from './AjustementStockButton'

export default async function StockPage() {
  const context = await requireGerant()
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, unite, seuil_alerte')
    .eq('actif', true)
    .order('designation')

  const { data: stocks } = await supabase
    .from('stocks')
    .select('article_id, quantite, updated_at')
    .eq('magasin_id', context.magasinId)

  const { data: mouvements } = await supabase
    .from('mouvements_stock')
    .select('id, article_id, type_mouvement, quantite, motif, created_at')
    .eq('magasin_id', context.magasinId)
    .order('created_at', { ascending: false })
    .limit(20)

  const stockParArticle = new Map((stocks ?? []).map((s) => [s.article_id, s.quantite]))
  const articleParId = new Map((articles ?? []).map((a) => [a.id, a]))

  const libellesMouvement: Record<string, string> = {
    entree_achat: 'Entrée (achat)',
    sortie_vente: 'Sortie (vente)',
    ajustement_positif: 'Ajustement +',
    ajustement_negatif: 'Ajustement -',
    transfert_entree: 'Transfert (entrée)',
    transfert_sortie: 'Transfert (sortie)',
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">Stock</h2>
          <p className="mt-2 text-sm text-foreground-muted">Niveaux de stock actuels et derniers mouvements.</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <AjustementStockButton articles={(articles ?? []).map((a) => ({ id: a.id, designation: a.designation, unite: a.unite }))} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Article</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Quantité disponible</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(articles ?? []).map((article) => {
              const quantite = stockParArticle.get(article.id) ?? 0
              const bas = quantite <= (article.seuil_alerte ?? 0)
              return (
                <tr key={article.id} className="hover:bg-background/50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{article.designation}</td>
                  <td className="px-3 py-4 text-sm text-right text-foreground">{Number(quantite).toLocaleString('fr-FR')} {article.unite}</td>
                  <td className="px-3 py-4 text-sm">
                    {bas ? (
                      <span className="inline-flex items-center gap-1 text-warning font-medium">
                        <AlertTriangle className="h-4 w-4" /> Stock bas
                      </span>
                    ) : (
                      <span className="text-success font-medium">OK</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {(articles ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-sm text-foreground-muted">Aucun article actif</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-10 mb-4 text-lg font-semibold text-foreground">Derniers mouvements</h3>
      <div className="overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Date</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Article</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Type</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Quantité</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Motif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(mouvements ?? []).map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground">{articleParId.get(m.article_id)?.designation ?? '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{libellesMouvement[m.type_mouvement] ?? m.type_mouvement}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(m.quantite).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{m.motif || '-'}</td>
              </tr>
            ))}
            {(mouvements ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-foreground-muted">Aucun mouvement</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
