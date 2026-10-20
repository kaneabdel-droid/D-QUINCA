'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { resoudreAuthEmail } from '@/lib/auth-identifier'

export type LoginActionResult = {
  success?: boolean
  error?: string
  redirectUrl?: string
  userContext?: {
    userId: string
    nomComplet?: string | null
    identifiant: string
    telephone?: string | null
    email?: string | null
    role: string
    entrepriseId: string
    entrepriseNom: string
    magasinId?: string | null
    magasinNom?: string | null
    gieId?: string
    gieNom?: string
    devise?: string
    permissions?: any
  }
}

export async function login(formData: FormData): Promise<LoginActionResult> {
  const cookieStore = await cookies()

  const lockoutUntil = cookieStore.get('lockout_until')?.value
  if (lockoutUntil && parseInt(lockoutUntil) > Date.now()) {
    return {
      error: 'Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.',
    }
  }

  const rawIdentifier = ((formData.get('email') as string) || (formData.get('identifier') as string) || '').trim()
  const password = (formData.get('password') as string) || ''

  if (!rawIdentifier) {
    return { error: 'Veuillez renseigner votre identifiant, téléphone ou e-mail.' }
  }
  if (!password) {
    return { error: 'Veuillez saisir votre mot de passe.' }
  }

  let resolvedEmail = rawIdentifier
  try {
    const adminSupabase = createAdminClient()
    const resolved = await resoudreAuthEmail(rawIdentifier, adminSupabase)
    resolvedEmail = resolved.email
  } catch {
    resolvedEmail = rawIdentifier
  }

  const supabase = await createClient()
  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  })

  if (error || !signInData?.user) {
    const attemptsCookie = cookieStore.get('login_attempts')?.value
    const attempts = attemptsCookie ? parseInt(attemptsCookie) + 1 : 1

    if (attempts >= 3) {
      cookieStore.set('lockout_until', (Date.now() + 60_000).toString(), { maxAge: 60 })
      cookieStore.delete('login_attempts')
      return {
        error: 'Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.',
      }
    } else {
      cookieStore.set('login_attempts', attempts.toString(), { maxAge: 300 })
      return {
        error: 'Identifiant ou mot de passe non conforme. Veuillez réessayer.',
      }
    }
  }

  cookieStore.delete('login_attempts')
  cookieStore.delete('lockout_until')

  let userContext: LoginActionResult['userContext']
  try {
    const { data: userProfile } = await supabase
      .from('utilisateurs')
      .select('id, identifiant, telephone, nom_complet, role, entreprise_id, entreprises(nom, devise), magasin_id, magasins(nom)')
      .eq('id', signInData.user.id)
      .maybeSingle()

    if (userProfile) {
      const ent = Array.isArray(userProfile.entreprises) ? userProfile.entreprises[0] : userProfile.entreprises
      const mag = Array.isArray(userProfile.magasins) ? userProfile.magasins[0] : userProfile.magasins
      userContext = {
        userId: userProfile.id,
        nomComplet: userProfile.nom_complet || null,
        identifiant: userProfile.identifiant || rawIdentifier,
        telephone: userProfile.telephone || null,
        email: signInData.user.email || null,
        role: userProfile.role || 'gerant',
        entrepriseId: userProfile.entreprise_id,
        entrepriseNom: ent?.nom || 'Ma Quincaillerie',
        magasinId: userProfile.magasin_id || null,
        magasinNom: mag?.nom || null,
        gieId: userProfile.entreprise_id,
        gieNom: ent?.nom || 'Ma Quincaillerie',
        devise: ent?.devise || 'XOF',
      }
    }
  } catch (err) {
    console.warn('Erreur récupération profil utilisateur pour cache hors-ligne D-QUINCA:', err)
  }

  revalidatePath('/', 'layout')

  return {
    success: true,
    redirectUrl: '/dashboard',
    userContext,
  }
}
