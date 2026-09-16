'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { deleteFournisseur } from './actions'

export default function DeleteFournisseurButton({ id, nom, dict }: { id: string; nom: string; dict: Dictionary }) {
  const t = dict.fournisseurs
  const c = dict.common

  async function handleDelete() {
    if (!confirm(t.confirmDelete.replace('{nom}', nom))) return
    const res = await deleteFournisseur(id)
    if (res?.error) toast.error(res.error)
    else toast.success(t.deleted)
  }

  return (
    <button onClick={handleDelete} className="text-foreground-muted hover:text-danger p-1" title={c.delete}>
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
