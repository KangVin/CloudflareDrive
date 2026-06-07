import type { FileRecord } from '@/types'
import { fetchJson, fetchVoid } from './client'

const BASE = '/api/v1/trash'

export async function listTrashed(): Promise<FileRecord[]> {
  return fetchJson(BASE, undefined, 'Failed to list trash')
}

export async function restoreFile(id: string): Promise<void> {
  return fetchVoid(`${BASE}/${id}/restore`, { method: 'POST' }, 'Failed to restore file')
}

export async function permanentDelete(id: string): Promise<void> {
  return fetchVoid(`${BASE}/${id}`, { method: 'DELETE' }, 'Failed to delete file')
}

export async function emptyTrash(): Promise<void> {
  return fetchVoid(`${BASE}/empty`, { method: 'POST' }, 'Failed to empty trash')
}
