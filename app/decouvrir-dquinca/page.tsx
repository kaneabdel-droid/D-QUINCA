import Link from 'next/link'
import { ArrowLeft, ArrowRight, Building2, LayoutDashboard, Boxes, ShoppingCart, HandCoins, Wallet } from 'lucide-react'
import { loginDemo } from './actions'

export const metadata = {
  title: 'Découvrir D-QUINCA — Comment ça marche',
}

export default async function DecouvrirDquincaPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo_error?: string }>
}) {
  const params = await searchParams
  const demoError = params?.demo_error === '1'

  return (
    <div className="bg-background min-h-screen font-sans text-foreground">
      <main>
        {/* Hero */}
        <section className="py-16 lg:py-24 bg-gradient-to-br from-surface to-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
            <Link href="/" className="text-sm font-medium text-foreground-muted hover:text-primary flex items-center justify-center gap-2 mb-6">
              <ArrowLeft className="w-4 h-4" /> Retour à l&apos;accueil
            </Link>
            <h1 className="text-4xl md:text-6xl font-bold font-heading tracking-tight mb-6">
              Comment fonctionne <span className="text-primary">D-QUINCA</span> ?
            </h1>
            <p className="text-lg md:text-xl text-foreground-muted leading-relaxed">
              Stock, ventes, achats, créances/dettes et trésorerie — un ou plusieurs magasins, un seul tableau de bord.
            </p>
          </div>
        </section>

        {/* Démo en direct */}
        <section className="py-16 bg-primary/5 border-y border-surface-border">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold font-heading mb-3">Essayez la démo en un clic</h2>
            <p className="text-foreground-muted mb-8">
              Entreprise de démonstration <strong>SUNUQuinca</strong> (2 magasins, données réelles d&apos;achats, ventes et stock) — choisissez un point de vue.
            </p>
            {demoError && (
              <p className="mb-6 text-sm bg-danger/10 text-danger p-3 rounded-md max-w-md mx-auto">
                Connexion démo indisponible pour le moment. Réessayez dans un instant.
              </p>
            )}
            <div className="grid sm:grid-cols-3 gap-4">
              <form action={loginDemo}>
                <input type="hidden" name="role" value="admin" />
                <button type="submit" className="w-full flex flex-col items-center gap-2 rounded-xl border border-surface-border bg-background p-5 hover:border-primary hover:shadow-md transition-all">
                  <Building2 className="w-6 h-6 text-primary" />
                  <span className="font-semibold">Vue consolidée</span>
                  <span className="text-xs text-foreground-muted">Administrateur entreprise</span>
                </button>
              </form>
              <form action={loginDemo}>
                <input type="hidden" name="role" value="gerant1" />
                <button type="submit" className="w-full flex flex-col items-center gap-2 rounded-xl border border-surface-border bg-background p-5 hover:border-primary hover:shadow-md transition-all">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                  <span className="font-semibold">SUNUQuinca1</span>
                  <span className="text-xs text-foreground-muted">Gérant, Dakar</span>
                </button>
              </form>
              <form action={loginDemo}>
                <input type="hidden" name="role" value="gerant2" />
                <button type="submit" className="w-full flex flex-col items-center gap-2 rounded-xl border border-surface-border bg-background p-5 hover:border-primary hover:shadow-md transition-all">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                  <span className="font-semibold">SUNUQuinca2</span>
                  <span className="text-xs text-foreground-muted">Gérant, Thiès</span>
                </button>
              </form>
            </div>
            <p className="mt-6 text-xs text-foreground-muted">
              Cet espace est partagé entre tous les visiteurs — évitez d&apos;y saisir des informations réelles.
            </p>
          </div>
        </section>

        {/* Modules */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
            <h2 className="text-3xl font-bold font-heading text-center mb-12">Un circuit complet, magasin par magasin</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Boxes, title: 'Stock en temps réel', desc: "Catégories, articles, seuils d'alerte et historique des mouvements." },
                { icon: ShoppingCart, title: 'Ventes & achats', desc: 'Comptant, crédit ou mixte, avec reçu et suivi des marges.' },
                { icon: HandCoins, title: 'Créances & dettes', desc: 'Qui vous doit, à qui vous devez, réglé en un clic.' },
                { icon: Wallet, title: 'Trésorerie', desc: 'Caisse, mobile money, banque — journal complet des mouvements.' },
              ].map((m, i) => (
                <div key={i} className="rounded-2xl border border-surface-border bg-surface p-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <m.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{m.title}</h3>
                  <p className="text-foreground-muted">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 bg-surface border-t border-surface-border text-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary-hover hover:scale-105 transition-all">
              S&apos;abonner <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-2xl font-bold font-heading text-background mb-4 block">D-QUINCA</span>
          <p className="text-background/50 text-sm">© {new Date().getFullYear()} Demba Solution.</p>
        </div>
      </footer>
    </div>
  )
}
