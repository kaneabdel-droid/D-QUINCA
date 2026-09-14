import { redirect } from 'next/navigation'
import { LayoutDashboard, Building2, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { createAdminIdentityClient } from '@/utils/supabase/admin-identity'
import { isAdminEmail } from '@/lib/admin/auth'

// Défense en profondeur : le middleware bloque déjà /admin aux non-admins, mais on
// re-vérifie ici (même pattern que (dashboard)/layout.tsx le fera pour les rôles).
// Double vérification comme dans le middleware : identité admin partagée (SSO
// inter-produits) d'abord, session admin locale à D-QUINCA en secours.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: localUser } } = await supabase.auth.getUser()

  const adminIdentitySupabase = await createAdminIdentityClient()
  const { data: { user: sharedUser } } = await adminIdentitySupabase.auth.getUser()

  const user = isAdminEmail(sharedUser?.email) ? sharedUser : localUser

  if (!isAdminEmail(sharedUser?.email) && !isAdminEmail(localUser?.email)) {
    redirect(localUser ? '/dashboard' : '/admin/login')
  }

  // Nav réduite à "Entreprises" : pas de Paiements/Config, la facturation SaaS
  // est hors périmètre du MVP D-QUINCA (cf. plan §0).
  const navItems = [
    { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/admin/entreprises', label: 'Entreprises', icon: Building2 },
  ]

  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="w-64 shrink-0 bg-background border-r border-surface-border flex flex-col">
        <div className="p-6 border-b border-surface-border">
          <p className="font-bold font-heading text-lg">D-QUINCA Admin</p>
          <p className="text-xs text-foreground-muted mt-1">{user?.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-surface-border">
          <a href="/admin/logout" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground-muted hover:bg-surface transition-colors">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </a>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
