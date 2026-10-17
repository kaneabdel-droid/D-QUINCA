'use client'

import { enqueueAction, QueuedAction } from './offline-storage'
import { syncEngine } from './sync-engine'

export interface OfflineSafeOptions<T> {
  actionType: string
  label: string
  payload: any
  onlineAction: () => Promise<T>
}

export interface OfflineSafeResult<T> {
  success: boolean
  offline?: boolean
  data?: T
  error?: string
  queuedAction?: QueuedAction
}

function isNetworkError(error: any): boolean {
  if (!error) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = (error?.message || String(error)).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('offline') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('load failed')
  )
}

export async function executeOfflineSafe<T>({
  actionType,
  label,
  payload,
  onlineAction
}: OfflineSafeOptions<T>): Promise<OfflineSafeResult<T>> {
  // If explicitly offline, enqueue immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const queuedAction = await enqueueAction({ actionType, label, payload })
    return {
      success: true,
      offline: true,
      queuedAction
    }
  }

  // Otherwise, attempt online action
  try {
    const data = await onlineAction()
    // In server actions, error may be returned inside { error: '...' }
    if ((data as any)?.error && isNetworkError((data as any).error)) {
      const queuedAction = await enqueueAction({ actionType, label, payload })
      return { success: true, offline: true, queuedAction }
    }
    return { success: true, data }
  } catch (err: any) {
    if (isNetworkError(err)) {
      const queuedAction = await enqueueAction({ actionType, label, payload })
      return {
        success: true,
        offline: true,
        queuedAction
      }
    }
    return {
      success: false,
      error: err?.message || 'Erreur inattendue'
    }
  }
}
