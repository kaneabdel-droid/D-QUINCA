'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteCharge } from './actions'

export default function DeleteChargeButton({ id }: { id: string }) {
  async function handleDelete() {
    if (!confirm('Supprimer cette charge ?')) return
    const res = await deleteCharge(id)
    if (res?.error) toast.error(res.error)
    else toast.success('Charge supprimée')
  }

  return (
    <button onClick={handleDelete} className="text-foreground-muted hover:text-danger p-1" title="Supprimer">
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
