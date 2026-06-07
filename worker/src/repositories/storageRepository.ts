const TEMP_CHUNK_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function createStorageRepository(storage: R2Bucket) {
  async function upload(key: string, value: ReadableStream | ArrayBuffer | Blob) {
    return await storage.put(key, value)
  }

  async function download(key: string) {
    return await storage.get(key)
  }

  async function remove(key: string): Promise<void> {
    await storage.delete(key)
  }

  async function deleteChunks(prefix: string, total: number): Promise<void> {
    const keys = Array.from({ length: total }, (_, i) => `${prefix}${i}`)
    await storage.delete(keys)
  }

  /** Delete orphaned temp chunks uploaded before the cutoff time. Returns count of deleted objects. */
  async function deleteOrphanedTempChunks(cutoff: Date): Promise<number> {
    let deleted = 0
    let cursor: string | undefined
    do {
      const result = await storage.list({ prefix: 'temp/', cursor, limit: 1000 })
      const staleKeys = result.objects.filter((obj) => obj.uploaded < cutoff).map((obj) => obj.key)
      if (staleKeys.length > 0) {
        await storage.delete(staleKeys)
        deleted += staleKeys.length
      }
      cursor = result.truncated ? result.cursor : undefined
    } while (cursor)
    return deleted
  }

  return { upload, download, remove, deleteChunks, deleteOrphanedTempChunks }
}

export { TEMP_CHUNK_TTL_MS }
