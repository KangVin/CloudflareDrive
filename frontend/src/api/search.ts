import type { FileRecord } from '@/types'
import { fetchJson } from './client'

export async function searchFiles(query: string): Promise<FileRecord[]> {
  return fetchJson(`/api/v1/files/search?q=${encodeURIComponent(query)}`, undefined, 'Search failed')
}
