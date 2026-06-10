import type { FileRecord } from '@/types'
import { fetchJson, fetchVoid } from './client'

const BASE = '/api/v1/files'

export async function listFiles(parentId?: string): Promise<FileRecord[]> {
  const params = parentId ? `?parentId=${parentId}` : ''
  return fetchJson(`${BASE}${params}`, undefined, 'Failed to list files')
}

export async function getFile(id: string): Promise<FileRecord> {
  return fetchJson(`${BASE}/${id}`, undefined, 'File not found')
}

export async function createFolder(name: string, parentId?: string | null): Promise<FileRecord> {
  return fetchJson(
    BASE,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    },
    'Failed to create folder',
  )
}

export async function updateFile(id: string, data: { name?: string; parentId?: string | null }): Promise<FileRecord> {
  return fetchJson(
    `${BASE}/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Failed to update file',
  )
}

export async function copyFile(id: string, parentId?: string | null): Promise<FileRecord> {
  return fetchJson(
    `${BASE}/${id}/copy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId }),
    },
    'Failed to copy file',
  )
}

export async function trashFile(id: string, permanent?: boolean): Promise<void> {
  const params = permanent ? '?permanent=true' : ''
  return fetchVoid(`${BASE}/${id}${params}`, { method: 'DELETE' }, 'Failed to trash file')
}
