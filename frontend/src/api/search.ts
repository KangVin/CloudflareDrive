import type { FileRecord } from '@/types'

export async function searchFiles(query: string): Promise<FileRecord[]> {
  const res = await fetch(`/api/v1/files/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}
