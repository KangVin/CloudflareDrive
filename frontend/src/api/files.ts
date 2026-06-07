import type { FileRecord } from '@/types'

const BASE = '/api/v1/files'

export async function listFiles(parentId?: string): Promise<FileRecord[]> {
  const params = parentId ? `?parentId=${parentId}` : ''
  const res = await fetch(`${BASE}${params}`)
  if (!res.ok) throw new Error('Failed to list files')
  return res.json()
}

export async function getFile(id: string): Promise<FileRecord> {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error('File not found')
  return res.json()
}

export async function createFolder(name: string, parentId?: string | null): Promise<FileRecord> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  })
  if (!res.ok) throw new Error('Failed to create folder')
  return res.json()
}

export async function updateFile(id: string, data: { name?: string; parentId?: string | null }): Promise<FileRecord> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update file')
  return res.json()
}

export async function trashFile(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to trash file')
}
