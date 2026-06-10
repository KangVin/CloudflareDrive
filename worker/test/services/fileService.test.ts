import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFileService } from '../../src/services/fileService'
import type { FileRecord, CreateFileInput } from '../../src/types/models'

type MockFileRepo = {
  findByParent: ReturnType<typeof vi.fn>
  findByParentPaginated: ReturnType<typeof vi.fn>
  countByParent: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findByHash: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  softDelete: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  findTrashed: ReturnType<typeof vi.fn>
  findByParentIncludingTrashed: ReturnType<typeof vi.fn>
  hardDelete: ReturnType<typeof vi.fn>
  countByR2Key: ReturnType<typeof vi.fn>
  search: ReturnType<typeof vi.fn>
}

type MockStorageRepo = {
  upload: ReturnType<typeof vi.fn>
  download: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  createMultipartUpload: ReturnType<typeof vi.fn>
  resumeMultipartUpload: ReturnType<typeof vi.fn>
  uploadPart: ReturnType<typeof vi.fn>
  completeMultipartUpload: ReturnType<typeof vi.fn>
  abortMultipartUpload: ReturnType<typeof vi.fn>
}

type MockShareRepo = {
  findAll: ReturnType<typeof vi.fn>
  findByToken: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findByFileId: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  removeByFileId: ReturnType<typeof vi.fn>
}

function createMockFileRepo(): MockFileRepo {
  return {
    findByParent: vi.fn(),
    findByParentPaginated: vi.fn(),
    countByParent: vi.fn(),
    findById: vi.fn(),
    findByHash: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    findTrashed: vi.fn(),
    findByParentIncludingTrashed: vi.fn(),
    hardDelete: vi.fn(),
    countByR2Key: vi.fn(),
    search: vi.fn(),
  }
}

function createMockStorageRepo(): MockStorageRepo {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    download: vi.fn(),
    remove: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
    uploadPart: vi.fn(),
    completeMultipartUpload: vi.fn(),
    abortMultipartUpload: vi.fn(),
  }
}

function createMockShareRepo(): MockShareRepo {
  return {
    findAll: vi.fn(),
    findByToken: vi.fn(),
    findById: vi.fn(),
    findByFileId: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    removeByFileId: vi.fn(),
  }
}

function makeFile(overrides: Partial<FileRecord> = {}): FileRecord {
  const id = crypto.randomUUID()
  return {
    id,
    name: 'test.txt',
    parentId: null,
    type: 'file',
    mimeType: 'text/plain',
    size: 100,
    hash: null,
    r2Key: `uploads/${id}/test.txt`,
    isTrashed: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('createFileService', () => {
  let fileRepo: MockFileRepo
  let storageRepo: MockStorageRepo
  let shareRepo: MockShareRepo
  let svc: ReturnType<typeof createFileService>

  beforeEach(() => {
    fileRepo = createMockFileRepo()
    storageRepo = createMockStorageRepo()
    shareRepo = createMockShareRepo()
    svc = createFileService(
      fileRepo as unknown as ReturnType<
        (typeof import('../../src/repositories/fileRepository'))['createFileRepository']
      >,
      storageRepo as unknown as ReturnType<
        (typeof import('../../src/repositories/storageRepository'))['createStorageRepository']
      >,
      shareRepo as unknown as ReturnType<
        (typeof import('../../src/repositories/shareRepository'))['createShareRepository']
      >,
    )
  })

  describe('list', () => {
    it('returns files from repository for given parentId', async () => {
      const files = [makeFile({ parentId: 'parent-1' })]
      fileRepo.findByParent.mockResolvedValue(files)
      const result = await svc.list('parent-1')
      expect(result).toEqual(files)
      expect(fileRepo.findByParent).toHaveBeenCalledWith('parent-1')
    })

    it('returns files from repository for null parentId', async () => {
      const files = [makeFile()]
      fileRepo.findByParent.mockResolvedValue(files)
      const result = await svc.list(null)
      expect(result).toEqual(files)
      expect(fileRepo.findByParent).toHaveBeenCalledWith(null)
    })
  })

  describe('get', () => {
    it('returns file by id', async () => {
      const file = makeFile()
      fileRepo.findById.mockResolvedValue(file)
      const result = await svc.get(file.id)
      expect(result).toEqual(file)
    })

    it('returns null for non-existent file', async () => {
      fileRepo.findById.mockResolvedValue(null)
      const result = await svc.get('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('createFolder', () => {
    it('creates a folder record', async () => {
      const folder = makeFile({ type: 'folder', name: 'my-folder', mimeType: null, size: 0, r2Key: null })
      fileRepo.create.mockResolvedValue(folder)
      const result = await svc.createFolder('my-folder', null)
      expect(result).toEqual(folder)
      expect(fileRepo.create).toHaveBeenCalledWith({
        name: 'my-folder',
        parentId: null,
        type: 'folder',
        mimeType: null,
        size: 0,
        r2Key: null,
      })
    })

    it('creates a folder with a parentId', async () => {
      const folder = makeFile({ type: 'folder', name: 'child', parentId: 'parent-1' })
      fileRepo.create.mockResolvedValue(folder)
      const result = await svc.createFolder('child', 'parent-1')
      expect(result).toEqual(folder)
      expect(fileRepo.create).toHaveBeenCalledWith({
        name: 'child',
        parentId: 'parent-1',
        type: 'folder',
        mimeType: null,
        size: 0,
        r2Key: null,
      })
    })
  })

  describe('update', () => {
    it('updates file name', async () => {
      const file = makeFile()
      const updated = { ...file, name: 'renamed.txt' }
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.update.mockResolvedValue(updated)
      const result = await svc.update(file.id, { name: 'renamed.txt' })
      expect(result.name).toBe('renamed.txt')
      expect(fileRepo.update).toHaveBeenCalledWith(file.id, { name: 'renamed.txt' })
    })

    it('moves a file to a different parent', async () => {
      const file = makeFile({ type: 'file' })
      const updated = { ...file, parentId: 'new-parent' }
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.update.mockResolvedValue(updated)
      const result = await svc.update(file.id, { parentId: 'new-parent' })
      expect(result.parentId).toBe('new-parent')
    })

    it('throws when moving a folder into itself', async () => {
      const folder = makeFile({ type: 'folder', id: 'folder-1', parentId: null })
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'folder-1') return folder
        return null
      })
      await expect(svc.update('folder-1', { parentId: 'folder-1' })).rejects.toThrow(
        'Cannot move a folder into itself or its descendants',
      )
    })

    it('throws when creating a descendant cycle', async () => {
      // root -> child -> grandchild
      const root = makeFile({ type: 'folder', id: 'root', parentId: null })
      const child = makeFile({ type: 'folder', id: 'child', parentId: 'root' })
      const grandchild = makeFile({ type: 'folder', id: 'grandchild', parentId: 'child' })
      // Try to move child under grandchild: child -> grandchild -> ??? (cycle!)
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'child') return child
        if (id === 'grandchild') return grandchild
        if (id === 'root') return root
        return null
      })
      await expect(svc.update('child', { parentId: 'grandchild' })).rejects.toThrow(
        'Cannot move a folder into itself or its descendants',
      )
    })
  })

  describe('createsFolderCycle', () => {
    it('allows moving folder to null parentId (root) without cycle', async () => {
      const file = makeFile({ type: 'folder', id: 'f1' })
      const updated = makeFile({ id: 'f1', parentId: null })
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.update.mockResolvedValue(updated)
      const result = await svc.update('f1', { parentId: null })
      expect(result.parentId).toBeNull()
    })

    it('allows moving file to any folder without cycle check', async () => {
      const file = makeFile({ type: 'file', id: 'f1' })
      const updated = makeFile({ id: 'f1', parentId: 'some-folder' })
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.update.mockResolvedValue(updated)
      const result = await svc.update('f1', { parentId: 'some-folder' })
      expect(result.parentId).toBe('some-folder')
    })
  })

  describe('upload', () => {
    it('uploads a file and creates a record', async () => {
      const buf = new ArrayBuffer(10)
      const file = makeFile({ name: 'doc.txt', parentId: null })
      fileRepo.create.mockResolvedValue(file)
      const result = await svc.upload('doc.txt', null, 'text/plain', buf)
      expect(result).toEqual(file)
      expect(storageRepo.upload).toHaveBeenCalled()
      expect(fileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'doc.txt',
          parentId: null,
          type: 'file',
          mimeType: 'text/plain',
          size: 10,
        }),
      )
    })

    it('deduplicates by hash when existing file found', async () => {
      const existing = makeFile({ hash: 'abc123', r2Key: 'existing-key' })
      fileRepo.findByHash.mockResolvedValue(existing)
      fileRepo.create.mockResolvedValue(existing)
      const buf = new ArrayBuffer(20)
      const result = await svc.upload('copy.txt', null, 'text/plain', buf, 'abc123')
      expect(result).toEqual(existing)
      expect(storageRepo.upload).not.toHaveBeenCalled()
      expect(fileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'copy.txt',
          hash: 'abc123',
          r2Key: 'existing-key',
        }),
      )
    })
  })

  describe('trash', () => {
    it('soft deletes a file', async () => {
      const file = makeFile({ type: 'file' })
      fileRepo.findById.mockResolvedValue(file)
      await svc.trash(file.id)
      expect(fileRepo.softDelete).toHaveBeenCalledWith(file.id)
    })

    it('recursively trashes folder children', async () => {
      const folder = makeFile({ type: 'folder', id: 'folder-1' })
      const child1 = makeFile({ type: 'file', id: 'child1', parentId: 'folder-1' })
      const child2 = makeFile({ type: 'folder', id: 'child2', parentId: 'folder-1' })
      const grandchild = makeFile({ type: 'file', id: 'grandchild', parentId: 'child2' })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'folder-1') return folder
        if (id === 'child1') return child1
        if (id === 'child2') return child2
        if (id === 'grandchild') return grandchild
        return null
      })
      fileRepo.findByParent.mockImplementation(async (parentId: string | null) => {
        if (parentId === 'folder-1') return [child1, child2]
        if (parentId === 'child2') return [grandchild]
        return []
      })

      await svc.trash('folder-1')
      expect(fileRepo.softDelete).toHaveBeenCalledWith('folder-1')
      expect(fileRepo.softDelete).toHaveBeenCalledWith('child1')
      expect(fileRepo.softDelete).toHaveBeenCalledWith('child2')
      expect(fileRepo.softDelete).toHaveBeenCalledWith('grandchild')
    })

    it('does nothing for non-existent file', async () => {
      fileRepo.findById.mockResolvedValue(null)
      await svc.trash('non-existent')
      expect(fileRepo.softDelete).not.toHaveBeenCalled()
    })
  })

  describe('restore', () => {
    it('restores a trashed file', async () => {
      const file = makeFile({ isTrashed: true })
      fileRepo.findById.mockResolvedValue(file)
      await svc.restore(file.id)
      expect(fileRepo.restore).toHaveBeenCalledWith(file.id)
    })

    it('recursively restores folder children', async () => {
      const folder = makeFile({ type: 'folder', id: 'folder-1', isTrashed: true })
      const child = makeFile({ type: 'file', id: 'child1', parentId: 'folder-1', isTrashed: true })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'folder-1') return folder
        if (id === 'child1') return child
        return null
      })
      fileRepo.findByParentIncludingTrashed.mockImplementation(async (parentId: string) => {
        if (parentId === 'folder-1') return [child]
        if (parentId === 'child1') return []
        return []
      })

      await svc.restore('folder-1')
      expect(fileRepo.restore).toHaveBeenCalledWith('folder-1')
      expect(fileRepo.restore).toHaveBeenCalledWith('child1')
    })
  })

  describe('copy', () => {
    it('returns null for non-existent file', async () => {
      fileRepo.findById.mockResolvedValue(null)
      const result = await svc.copy('non-existent', 'parent-1')
      expect(result).toBeNull()
    })

    it('returns null for trashed file', async () => {
      fileRepo.findById.mockResolvedValue(makeFile({ isTrashed: true }))
      const result = await svc.copy('trashed-id', 'parent-1')
      expect(result).toBeNull()
    })

    it('copies a file with a new R2 key', async () => {
      const file = makeFile({ r2Key: 'original-key' })
      const copied = makeFile({ name: file.name, parentId: 'new-parent' })
      fileRepo.findById.mockResolvedValue(file)
      storageRepo.download.mockResolvedValue({ body: new ReadableStream(), size: 100 })
      fileRepo.create.mockResolvedValue(copied)

      const result = await svc.copy(file.id, 'new-parent')
      expect(result).toEqual(copied)
      expect(storageRepo.download).toHaveBeenCalledWith('original-key')
      expect(storageRepo.upload).toHaveBeenCalled()
    })

    it('copies a folder recursively', async () => {
      const folder = makeFile({ type: 'folder', id: 'folder-1', r2Key: null })
      const childFile = makeFile({ type: 'file', id: 'child1', parentId: 'folder-1', r2Key: 'child-key' })
      const copiedFolder = makeFile({
        type: 'folder',
        id: 'copied-folder',
        name: 'folder-1',
        parentId: 'new-parent',
        r2Key: null,
      })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'folder-1') return folder
        if (id === 'child1') return childFile
        if (id === 'copied-folder') return copiedFolder
        return null
      })
      fileRepo.findByParent.mockImplementation(async (parentId: string | null) => {
        if (parentId === 'folder-1') return [childFile]
        return []
      })
      storageRepo.download.mockResolvedValue({ body: new ReadableStream(), size: 50 })

      // createFolder returns copiedFolder; upload for child returns another copy
      fileRepo.create.mockImplementation(async (input: CreateFileInput) => {
        if (input.type === 'folder') {
          return copiedFolder
        }
        return makeFile({ name: input.name, parentId: copiedFolder.id, r2Key: 'new-key' })
      })

      const result = await svc.copy('folder-1', 'new-parent')
      expect(result).toEqual(copiedFolder)
      expect(storageRepo.download).toHaveBeenCalledWith('child-key')
      expect(storageRepo.upload).toHaveBeenCalled()
    })
  })

  describe('permanentDelete', () => {
    it('deletes file and removes R2 key if no other reference', async () => {
      const file = makeFile({ r2Key: 'some-key' })
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.countByR2Key.mockResolvedValue(0)

      await svc.permanentDelete(file.id)
      expect(storageRepo.remove).toHaveBeenCalledWith('some-key')
      expect(fileRepo.hardDelete).toHaveBeenCalledWith(file.id)
    })

    it('does not remove R2 key if other references exist', async () => {
      const file = makeFile({ r2Key: 'shared-key' })
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.countByR2Key.mockResolvedValue(2)

      await svc.permanentDelete(file.id)
      expect(storageRepo.remove).not.toHaveBeenCalled()
      expect(fileRepo.hardDelete).toHaveBeenCalledWith(file.id)
    })

    it('removes share records on permanent delete', async () => {
      const file = makeFile({ r2Key: 'some-key' })
      fileRepo.findById.mockResolvedValue(file)
      fileRepo.countByR2Key.mockResolvedValue(0)

      await svc.permanentDelete(file.id)
      expect(shareRepo.removeByFileId).toHaveBeenCalledWith(file.id)
    })

    it('deletes folder children recursively', async () => {
      const folder = makeFile({ type: 'folder', id: 'folder-1', r2Key: null })
      const child = makeFile({ type: 'file', id: 'child1', parentId: 'folder-1', r2Key: 'child-key' })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'folder-1') return folder
        if (id === 'child1') return child
        return null
      })
      fileRepo.findByParentIncludingTrashed.mockImplementation(async (parentId: string) => {
        if (parentId === 'folder-1') return [child]
        return []
      })
      fileRepo.countByR2Key.mockResolvedValue(0)

      await svc.permanentDelete('folder-1')
      expect(fileRepo.hardDelete).toHaveBeenCalledWith('folder-1')
      expect(fileRepo.hardDelete).toHaveBeenCalledWith('child1')
      expect(storageRepo.remove).toHaveBeenCalledWith('child-key')
    })
  })

  describe('listTrashed', () => {
    it('returns trashed files from repository', async () => {
      const trashed = [makeFile({ isTrashed: true })]
      fileRepo.findTrashed.mockResolvedValue(trashed)
      const result = await svc.listTrashed()
      expect(result).toEqual(trashed)
    })
  })

  describe('emptyTrash', () => {
    it('permanently deletes all trashed items', async () => {
      const file1 = makeFile({ id: 'f1', r2Key: 'k1' })
      const file2 = makeFile({ id: 'f2', r2Key: 'k2' })
      fileRepo.findTrashed.mockResolvedValue([file1, file2])
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'f1') return file1
        if (id === 'f2') return file2
        return null
      })
      fileRepo.countByR2Key.mockResolvedValue(0)

      await svc.emptyTrash()
      expect(fileRepo.hardDelete).toHaveBeenCalledWith('f1')
      expect(fileRepo.hardDelete).toHaveBeenCalledWith('f2')
    })
  })

  describe('search', () => {
    it('delegates to repository', async () => {
      const results = [makeFile({ name: 'query-result' })]
      fileRepo.search.mockResolvedValue(results)
      const result = await svc.search('query')
      expect(result).toEqual(results)
      expect(fileRepo.search).toHaveBeenCalledWith('query')
    })
  })
})
