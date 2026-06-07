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

  return { upload, download, remove }
}
