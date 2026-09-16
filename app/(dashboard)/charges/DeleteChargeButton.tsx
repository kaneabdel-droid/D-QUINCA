'use client'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { deleteCharge } from './actions'

export default function DeleteChargeButton({ id, dict }: { id: string; dict: Dictionary }) {
  const t = dict.charges
  const c = dict.common

  async function handleDelete() {
    if (!confirm(t.confirmDelete)) return
    const res = await deleteCharge(id)
    if (res?.error) toast.error(res.error)
    else toast.success(t.deleted)
  }

  return (
    <button onClick={handleDelete} className="text-foreground-muted hover:text-danger p-1" title={c.delete}>
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
