'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addCharge(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant()
  const supabase = await createClient()

  const categorie = formData.get('categorie') as string
  const libelle = (formData.get('libelle') as string)?.trim() || null
  const montant = parseFloat(formData.get('montant') as string) || 0
  const dateCharge = formData.get('date_charge') as string
  const recurrente = formData.get('recurrente') === 'on'
  const compteTresorerieId = (formData.get('compte_tresorerie_id') as string) || null

  if (montant <= 0) return { error: 'Le montant doit être positif' }
  if (!dateCharge) return { error: 'La date est requise' }

  const { error } = await supabase.from('charges').insert({
    magasin_id: context.magasinId,
    compte_tresorerie_id: compteTresorerieId,
    categorie,
    libelle,
    montant,
    date_charge: dateCharge,
    recurrente,
    utilisateur_id: context.userId,
  })
  if (error) return { error: error.message }

  // Une charge payée depuis un compte de trésorerie en sort immédiatement —
  // sans compte sélectionné, elle reste enregistrée pour le calcul de
  // rentabilité mais n'impacte aucun solde de trésorerie.
  if (compteTresorerieId) {
    await supabase.from('journal_tresorerie').insert({
      magasin_id: context.magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'sortie',
      montant,
      categorie: 'charge',
      motif: libelle,
      utilisateur_id: context.userId,
    })
  }

  revalidatePath('/charges')
  revalidatePath('/tresorerie')
  return { success: true }
}

export async function deleteCharge(id: string): Promise<ActionResult> {
  await requireGerant()
  const supabase = await createClient()

  const { error } = await supabase.from('charges').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/charges')
  return { success: true }
}
