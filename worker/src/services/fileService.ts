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
  ): Promise<FileRecord> {
    const r2Key = `uploads/${crypto.randomUUID()}/${name}`
    await storageRepo.upload(r2Key, body)
    const input: CreateFileInput = {
      name,
      parentId,
      type: 'file',
      mimeType,
      size: body instanceof ArrayBuffer ? body.byteLength : 0,
      r2Key,
    }
    return await fileRepo.create(input)
  }

  async function update(id: string, input: UpdateFileInput): Promise<FileRecord> {
    return await fileRepo.update(id, input)
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
      const children = await fileRepo.findByParent(id)
      for (const child of children) {
        await restore(child.id)
      }
    }
    await fileRepo.restore(id)
  }

  async function listTrashed(): Promise<FileRecord[]> {
    return await fileRepo.findTrashed()
  }

  async function permanentDelete(id: string): Promise<void> {
    const file = await fileRepo.findById(id)
    if (!file) return
    if (file.type === 'folder') {
      await permanentDeleteChildren(id)
    }
    if (file.r2Key) {
      await storageRepo.remove(file.r2Key)
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
        await storageRepo.remove(child.r2Key)
      }
      await fileRepo.hardDelete(child.id)
    }
  }

  async function search(query: string): Promise<FileRecord[]> {
    return await fileRepo.search(query)
  }

  return { list, get, createFolder, upload, update, trash, restore, listTrashed, permanentDelete, search }
}
