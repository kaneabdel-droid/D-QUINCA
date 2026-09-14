'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('password_confirm') as string

  if (password !== passwordConfirm) {
    return redirect('/update-password?message=' + encodeURIComponent('Les mots de passe ne correspondent pas.'))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: password,
  })

  if (error) {
    return redirect('/update-password?message=' + encodeURIComponent(error.message))
  }

  return redirect('/login?message=' + encodeURIComponent('Mot de passe mis à jour avec succès.'))
}
