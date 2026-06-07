import type { FileRecord } from '@/types'

const BASE = '/api/v1/trash'

export async function listTrashed(): Promise<FileRecord[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to list trash')
  return res.json()
}

export async function restoreFile(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}/restore`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to restore file')
}

export async function permanentDelete(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete file')
}

export async function emptyTrash(): Promise<void> {
  const res = await fetch(`${BASE}/empty`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to empty trash')
}
