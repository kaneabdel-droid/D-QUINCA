import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import ClientLayout from './ClientLayout'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getCurrentUserContext() redirige déjà vers /login si aucune session (cf.
  // lib/auth/getCurrentUserContext.ts) — pas besoin de re-vérifier ici.
  const context = await getCurrentUserContext()

  return (
    <ClientLayout
      role={context.role}
      entrepriseNom={context.entrepriseNom}
      magasinNom={context.magasinNom}
    >
      {children}
    </ClientLayout>
  )
}
