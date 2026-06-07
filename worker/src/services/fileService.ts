import type { CreateFileInput, FileRecord, UpdateFileInput } from '../types/models'
import type { createFileRepository } from '../repositories/fileRepository'
import type { createStorageRepository } from '../repositories/storageRepository'

type FileRepo = ReturnType<typeof createFileRepository>
type StorageRepo = ReturnType<typeof createStorageRepository>

export function createFileService(fileRepo: FileRepo, storageRepo: StorageRepo) {
  async function list(parentId: string | null): Promise<FileRecord[]> {
    return await fileRepo.findByParent(parentId)
  }

  async function get(id: string): Promise<FileRecord | null> {
    return await fileRepo.findById(id)
  }

  async function createFolder(name: string, parentId: string | null): Promise<FileRecord> {
    const input: CreateFileInput = {
      name,
      parentId,
      type: 'folder',
      mimeType: null,
      size: 0,
      r2Key: null,
    }
    return await fileRepo.create(input)
  }

  async function upload(
    name: string,
    parentId: string | null,
    mimeType: string,
    body: ArrayBuffer | ReadableStream,
    hash?: string | null,
  ): Promise<FileRecord> {
    if (hash) {
      const existing = await fileRepo.findByHash(hash)
      if (existing && existing.r2Key) {
        const input: CreateFileInput = {
          name,
          parentId,
          type: 'file',
          mimeType,
          size: existing.size,
          hash: existing.hash,
          r2Key: existing.r2Key,
        }
        return await fileRepo.create(input)
      }
    }
    const r2Key = `uploads/${crypto.randomUUID()}/${name}`
    await storageRepo.upload(r2Key, body)
    const input: CreateFileInput = {
      name,
      parentId,
      type: 'file',
      mimeType,
      size: body instanceof ArrayBuffer ? body.byteLength : 0,
      hash: hash ?? null,
      r2Key,
    }
    return await fileRepo.create(input)
  }

  async function update(id: string, input: UpdateFileInput): Promise<FileRecord> {
    if (input.parentId !== undefined && (await createsFolderCycle(id, input.parentId))) {
      throw new Error('Cannot move a folder into itself or its descendants')
    }
    return await fileRepo.update(id, input)
  }

  async function createsFolderCycle(id: string, parentId: string | null): Promise<boolean> {
    if (parentId === null) return false
    const file = await fileRepo.findById(id)
    if (!file || file.type !== 'folder') return false
    let currentId: string | null = parentId
    while (currentId) {
      if (currentId === id) return true
      const current = await fileRepo.findById(currentId)
      currentId = current?.parentId ?? null
    }
    return false
  }

  async function copy(id: string, parentId: string | null): Promise<FileRecord | null> {
    const file = await fileRepo.findById(id)
    if (!file || file.isTrashed) return null
    if (file.type === 'folder') {
      const copiedFolder = await createFolder(file.name, parentId)
      const children = await fileRepo.findByParent(file.id)
      for (const child of children) {
        await copy(child.id, copiedFolder.id)
      }
      return copiedFolder
    }
    if (!file.r2Key) return null
    const obj = await storageRepo.download(file.r2Key)
    if (!obj || !obj.body) return null
    const r2Key = `uploads/${crypto.randomUUID()}/${file.name}`
    await storageRepo.upload(r2Key, obj.body)
    const input: CreateFileInput = {
      name: file.name,
      parentId,
      type: 'file',
      mimeType: file.mimeType,
      size: file.size,
      r2Key,
    }
    return await fileRepo.create(input)
  }

  async function trash(id: string): Promise<void> {
    const file = await fileRepo.findById(id)
    if (!file) return
    if (file.type === 'folder') {
      await trashChildren(id)
    }
    await fileRepo.softDelete(id)
  }

  async function trashChildren(parentId: string): Promise<void> {
    const children = await fileRepo.findByParent(parentId)
    for (const child of children) {
      if (child.type === 'folder') {
        await trashChildren(child.id)
      }
      await fileRepo.softDelete(child.id)
    }
  }

  async function restore(id: string): Promise<void> {
    const file = await fileRepo.findById(id)
    if (!file) return
    if (file.type === 'folder') {
      const children = await fileRepo.findByParentIncludingTrashed(id)
      for (const child of children) {
        if (child.isTrashed) {
          await restore(child.id)
        }
      }
    }
    await fileRepo.restore(id)
  }

  async function listTrashed(): Promise<FileRecord[]> {
    return await fileRepo.findTrashed()
  }

  async function emptyTrash(): Promise<void> {
    const trashed = await fileRepo.findTrashed()
    for (const file of trashed) {
      await permanentDelete(file.id)
    }
  }

  async function permanentDelete(id: string): Promise<void> {
    const file = await fileRepo.findById(id)
    if (!file) return
    if (file.type === 'folder') {
      await permanentDeleteChildren(id)
    }
    if (file.r2Key) {
      const refCount = await fileRepo.countByR2Key(file.r2Key, id)
      if (refCount === 0) {
        await storageRepo.remove(file.r2Key)
      }
    }
    await fileRepo.hardDelete(id)
  }

  async function permanentDeleteChildren(parentId: string): Promise<void> {
    const children = await fileRepo.findByParent(parentId)
    for (const child of children) {
      if (child.type === 'folder') {
        await permanentDeleteChildren(child.id)
      }
      if (child.r2Key) {
        const refCount = await fileRepo.countByR2Key(child.r2Key, child.id)
        if (refCount === 0) {
          await storageRepo.remove(child.r2Key)
        }
      }
      await fileRepo.hardDelete(child.id)
    }
  }

  async function finalizeChunkedUpload(
    uploadId: string,
    totalChunks: number,
    parentId: string | null,
    name: string,
    mimeType: string,
  ): Promise<FileRecord> {
    const r2Key = `uploads/${crypto.randomUUID()}/${name}`
    const tempPrefix = `temp/${uploadId}/`

    let totalSize = 0
    for (let i = 0; i < totalChunks; i++) {
      const obj = await storageRepo.download(`${tempPrefix}${i}`)
      if (!obj) throw new Error(`Chunk ${i} not found`)
      totalSize += obj.size
    }

    const fixed = new FixedLengthStream(totalSize)
    const writer = fixed.writable.getWriter()

    const pipe = (async () => {
      try {
        for (let i = 0; i < totalChunks; i++) {
          const obj = await storageRepo.download(`${tempPrefix}${i}`)
          if (!obj?.body) throw new Error(`Chunk ${i} not found`)
          const reader = obj.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            await writer.write(value)
          }
        }
        await writer.close()
      } catch (e) {
        await writer.abort(e)
        throw e
      }
    })()

    const [uploadResult, pipeResult] = await Promise.all([
      storageRepo.upload(r2Key, fixed.readable).catch((e) => e),
      pipe.catch((e) => e),
    ])
    if (uploadResult instanceof Error) throw uploadResult
    if (pipeResult instanceof Error) throw pipeResult
    await storageRepo.deleteChunks(tempPrefix, totalChunks)

    const input: CreateFileInput = {
      name,
      parentId,
      type: 'file',
      mimeType,
      size: totalSize,
      r2Key,
    }
    return await fileRepo.create(input)
  }

  async function checkHash(hash: string): Promise<FileRecord | null> {
    return await fileRepo.findByHash(hash)
  }

  async function instant(
    hash: string,
    parentId: string | null,
    name: string,
    mimeType: string,
  ): Promise<FileRecord | null> {
    const existing = await fileRepo.findByHash(hash)
    if (!existing || !existing.r2Key) return null
    const input: CreateFileInput = {
      name,
      parentId,
      type: 'file',
      mimeType,
      size: existing.size,
      hash: existing.hash,
      r2Key: existing.r2Key,
    }
    return await fileRepo.create(input)
  }

  async function search(query: string): Promise<FileRecord[]> {
    return await fileRepo.search(query)
  }

  return {
    list,
    get,
    createFolder,
    upload,
    update,
    copy,
    trash,
    restore,
    listTrashed,
    emptyTrash,
    permanentDelete,
    checkHash,
    instant,
    finalizeChunkedUpload,
    search,
  }
}
