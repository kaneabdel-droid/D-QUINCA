import Link from 'next/link'
import { ArrowLeft, ArrowRight, Boxes, Receipt, Store } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import RevealGroup from '@/components/RevealGroup'
import { getDictionary, getLocale } from '@/dictionaries'

export default async function HomePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const h = dict.home
  const features = [
    { icon: Boxes, key: 'stock' as const },
    { icon: Receipt, key: 'ventes' as const },
    { icon: Store, key: 'magasins' as const },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="border-b border-surface-border bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a
            href="https://www.dembasolution.com"
            className="flex items-center gap-2 text-sm font-medium text-foreground-muted hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> {h.backToDemba}
          </a>
          <div className="flex items-center gap-4">
            <LanguageSelector currentLang={locale} />
            <Link
              href="/tarifs"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              {h.subscribe}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">— {h.eyebrow}</p>
          <h1 className="mt-4 font-heading text-5xl font-bold leading-tight">
            {h.heroA}
            <br />
            <span className="text-primary">{h.heroB}</span>
          </h1>
          <p className="mt-5 max-w-md text-foreground-muted">{h.tagline}</p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/tarifs"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              {h.subscribe}
            </Link>
            <Link
              href="/decouvrir-dquinca"
              className="text-sm font-semibold text-foreground-muted hover:text-primary"
            >
              {h.discover}
            </Link>
          </div>
        </div>
        <div className="rounded-3xl bg-primary p-8 text-white shadow-lg">
          <div className="space-y-3">
            {features.map(({ icon: Icon, key }, i) => (
              <div
                key={key}
                className="drop-in flex items-center gap-4 rounded-2xl bg-white/10 p-5"
                style={{ '--drop-delay': `${0.3 + i * 1}s` } as React.CSSProperties}
              >
                <Icon className="h-6 w-6 text-secondary" />
                <p className="font-heading text-lg font-semibold">{h.features[key].title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-surface-border bg-sidebar">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
          {h.stats.map(([title, sub]: string[], i: number) => (
            <div key={i}>
              <p className="font-heading text-2xl font-bold">{title}</p>
              <p className="text-sm text-foreground-muted">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solutions */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{h.solutionsEyebrow}</p>
        <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold">{h.solutionsTitle}</h2>
        <RevealGroup className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, key }, i) => (
            <div
              key={key}
              className="reveal rounded-2xl border border-surface-border bg-surface p-6"
              style={{ '--reveal-index': i } as React.CSSProperties}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold">{h.features[key].title}</h3>
              <p className="mt-2 text-sm text-foreground-muted">{h.features[key].desc}</p>
              <Link
                href="/decouvrir-dquinca"
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover"
              >
                {h.learn} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          ))}
        </RevealGroup>
      </section>

      {/* How it works (dark band) */}
      <section className="bg-[#2E2118] text-[#F5F2EB]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{h.howEyebrow}</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold">{h.howTitle}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {h.steps.map(([title, desc]: string[], i: number) => (
              <li key={i}>
                <span className="font-heading text-4xl font-bold text-secondary">0{i + 1}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[#C2B2A0]">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{h.ctaEyebrow}</p>
        <h2 className="mt-3 font-heading text-4xl font-bold">{h.ctaTitle}</h2>
        <p className="mt-4 text-foreground-muted">{h.ctaSub}</p>
        <Link
          href="/tarifs"
          className="mt-8 inline-block rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          {h.subscribe}
        </Link>
      </section>

      <footer className="border-t border-surface-border bg-sidebar py-6 text-center text-sm text-foreground-muted">
        © {new Date().getFullYear()} {h.title}
      </footer>
    </div>
  )
}
