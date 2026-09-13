import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import CreateArticleButton from './CreateArticleButton'
import ArticleRowActions from './ArticleRowActions'

export default async function ArticlesPage() {
  await requireGerant()
  const supabase = await createClient()

  const { data: categories } = await supabase.from('categories').select('id, nom').order('nom')
  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, reference, categorie_id, unite, prix_vente, seuil_alerte, actif, categories(nom)')
    .order('designation')

  const categorieParId = new Map((categories ?? []).map((c) => [c.id, c.nom]))

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">Articles</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Catalogue d&apos;articles, partagé entre tous les magasins de l&apos;entreprise.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateArticleButton categories={categories ?? []} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">Désignation</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Référence</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Catégorie</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Unité</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">Prix de vente</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(articles ?? []).map((article) => (
              <tr key={article.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{article.designation}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{article.reference || '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{article.categorie_id ? categorieParId.get(article.categorie_id) : '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{article.unite}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(article.prix_vente).toLocaleString('fr-FR')}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <ArticleRowActions article={article} categories={categories ?? []} />
                </td>
              </tr>
            ))}
            {(articles ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">Aucun article</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
