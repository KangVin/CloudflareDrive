import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createShareService } from '../../src/services/shareService'
import type { FileRecord, ShareRecord } from '../../src/types/models'

type MockShareRepo = {
  findAll: ReturnType<typeof vi.fn>
  findByToken: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findByFileId: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  removeByFileId: ReturnType<typeof vi.fn>
}

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

function makeShare(overrides: Partial<ShareRecord> = {}): ShareRecord {
  return {
    id: crypto.randomUUID(),
    fileId: crypto.randomUUID(),
    token: crypto.randomUUID(),
    expiresAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('createShareService', () => {
  let shareRepo: MockShareRepo
  let fileRepo: MockFileRepo
  let svc: ReturnType<typeof createShareService>

  beforeEach(() => {
    shareRepo = createMockShareRepo()
    fileRepo = createMockFileRepo()
    svc = createShareService(
      shareRepo as unknown as ReturnType<
        (typeof import('../../src/repositories/shareRepository'))['createShareRepository']
      >,
      fileRepo as unknown as ReturnType<
        (typeof import('../../src/repositories/fileRepository'))['createFileRepository']
      >,
    )
  })

  describe('create', () => {
    it('creates a share link for a file', async () => {
      const file = makeFile()
      const share = makeShare({ fileId: file.id })
      fileRepo.findById.mockResolvedValue(file)
      shareRepo.create.mockResolvedValue(share)

      const result = await svc.create(file.id, null)
      expect(result).toEqual(share)
      expect(fileRepo.findById).toHaveBeenCalledWith(file.id)
      expect(shareRepo.create).toHaveBeenCalledWith({
        fileId: file.id,
        token: expect.any(String),
        expiresAt: null,
      })
    })

    it('creates a share link with expiration', async () => {
      const file = makeFile()
      const expiresAt = '2025-01-01T00:00:00Z'
      shareRepo.create.mockResolvedValue(makeShare({ fileId: file.id, expiresAt }))
      fileRepo.findById.mockResolvedValue(file)

      await svc.create(file.id, expiresAt)
      expect(shareRepo.create).toHaveBeenCalledWith({
        fileId: file.id,
        token: expect.any(String),
        expiresAt,
      })
    })

    it('throws when file is not found', async () => {
      fileRepo.findById.mockResolvedValue(null)
      await expect(svc.create('non-existent', null)).rejects.toThrow('File not found')
    })
  })

  describe('revoke', () => {
    it('removes a share by id', async () => {
      await svc.revoke('share-id')
      expect(shareRepo.remove).toHaveBeenCalledWith('share-id')
    })
  })

  describe('list', () => {
    it('returns all shares with path', async () => {
      const file = makeFile({ id: 'file-1', name: 'doc.txt', parentId: null })
      const share = makeShare({ fileId: 'file-1', token: 't1' })
      shareRepo.findAll.mockResolvedValue([{ ...share, fileName: 'doc.txt', fileType: 'file' }])
      fileRepo.findById.mockResolvedValue(file)

      const result = await svc.list()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        fileName: 'doc.txt',
        token: 't1',
      })
    })

    it('builds path for nested files', async () => {
      const file = makeFile({ id: 'file-2', name: 'deep.txt', parentId: 'folder-id' })
      const folder = makeFile({ id: 'folder-id', name: 'my-folder', parentId: null, type: 'folder' })
      const share = makeShare({ fileId: 'file-2', token: 't2' })
      shareRepo.findAll.mockResolvedValue([{ ...share, fileName: 'deep.txt', fileType: 'file' }])

      // First call for buildPath gets the file, second gets the parent folder
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'file-2') return file
        if (id === 'folder-id') return folder
        return null
      })

      const result = await svc.list()
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('my-folder')
    })
  })

  describe('getPublic', () => {
    it('returns null when share not found', async () => {
      shareRepo.findByToken.mockResolvedValue(null)
      const result = await svc.getPublic('invalid-token')
      expect(result).toBeNull()
    })

    it('returns null when share is expired', async () => {
      const share = makeShare({ expiresAt: '2020-01-01T00:00:00Z' })
      shareRepo.findByToken.mockResolvedValue(share)
      const result = await svc.getPublic('expired-token')
      expect(result).toBeNull()
    })

    it('returns null when file is trashed', async () => {
      const share = makeShare({ fileId: 'file-1' })
      shareRepo.findByToken.mockResolvedValue(share)
      fileRepo.findById.mockResolvedValue(makeFile({ id: 'file-1', isTrashed: true }))
      const result = await svc.getPublic('token')
      expect(result).toBeNull()
    })

    it('returns file info for a shared file', async () => {
      const share = makeShare({ fileId: 'file-1', token: 't1' })
      const file = makeFile({ id: 'file-1', name: 'photo.jpg', mimeType: 'image/jpeg', size: 2048 })
      shareRepo.findByToken.mockResolvedValue(share)
      fileRepo.findById.mockResolvedValue(file)

      const result = await svc.getPublic('t1')
      expect(result).toEqual({
        type: 'file',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
        sizeFormatted: '2.0 KB',
        downloadUrl: '/api/v1/s/t1/download',
      })
    })

    it('returns folder contents with pagination', async () => {
      const share = makeShare({ fileId: 'folder-1', token: 't1' })
      const folder = makeFile({ id: 'folder-1', name: 'shared-folder', type: 'folder', r2Key: null })
      const child1 = makeFile({ id: 'child1', name: 'a.txt', parentId: 'folder-1', mimeType: 'text/plain', size: 100 })
      const child2 = makeFile({ id: 'child2', name: 'b.txt', parentId: 'folder-1', mimeType: 'text/plain', size: 200 })

      shareRepo.findByToken.mockResolvedValue(share)
      fileRepo.findById.mockResolvedValue(folder)
      fileRepo.findByParentPaginated.mockResolvedValue({ items: [child1, child2], total: 2 })

      const result = await svc.getPublic('t1')
      expect(result).toEqual({
        type: 'folder',
        id: 'folder-1',
        name: 'shared-folder',
        files: [
          { id: 'child1', name: 'a.txt', type: 'file', mimeType: 'text/plain', size: 100, sizeFormatted: '100.0 B' },
          { id: 'child2', name: 'b.txt', type: 'file', mimeType: 'text/plain', size: 200, sizeFormatted: '200.0 B' },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      })
    })
  })

  describe('getPublicBrowse', () => {
    it('returns null when share not found', async () => {
      shareRepo.findByToken.mockResolvedValue(null)
      const result = await svc.getPublicBrowse('invalid-token', 'folder-id')
      expect(result).toBeNull()
    })

    it('returns null when share is expired', async () => {
      shareRepo.findByToken.mockResolvedValue({
        ...makeShare({ expiresAt: '2020-01-01T00:00:00Z' }),
        fileName: '',
        fileType: 'file',
      })
      const result = await svc.getPublicBrowse('expired-token', 'folder-id')
      expect(result).toBeNull()
    })

    it('returns null when browse target is outside shared tree', async () => {
      const share = makeShare({ fileId: 'shared-folder' })
      shareRepo.findByToken.mockResolvedValue(share)
      // Only share.fileId exists in fileRepo; folderId is not a descendant
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'shared-folder') return makeFile({ id: 'shared-folder', type: 'folder', r2Key: null })
        if (id === 'outside-folder')
          return makeFile({ id: 'outside-folder', parentId: null, type: 'folder', r2Key: null })
        return null
      })

      const result = await svc.getPublicBrowse('token', 'outside-folder')
      expect(result).toBeNull()
    })

    it('returns null when browsed folder is trashed', async () => {
      const share = makeShare({ fileId: 'root-folder' })
      shareRepo.findByToken.mockResolvedValue({ ...share, fileName: '', fileType: 'folder' })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'root-folder') return makeFile({ id: 'root-folder', type: 'folder', r2Key: null })
        if (id === 'trashed-folder')
          return makeFile({
            id: 'trashed-folder',
            parentId: 'root-folder',
            type: 'folder',
            r2Key: null,
            isTrashed: true,
          })
        return null
      })

      const result = await svc.getPublicBrowse('token', 'trashed-folder')
      expect(result).toBeNull()
    })

    it('returns folder contents for valid browse', async () => {
      const share = makeShare({ fileId: 'root-folder' })
      shareRepo.findByToken.mockResolvedValue(share)

      const root = makeFile({ id: 'root-folder', type: 'folder', r2Key: null })
      const sub = makeFile({
        id: 'sub-folder',
        parentId: 'root-folder',
        name: 'sub-folder',
        type: 'folder',
        r2Key: null,
      })
      const child = makeFile({
        id: 'child',
        parentId: 'sub-folder',
        name: 'nested.txt',
        size: 50,
        mimeType: 'text/plain',
      })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'root-folder') return root
        if (id === 'sub-folder') return sub
        if (id === 'child') return child
        return null
      })
      fileRepo.findByParentPaginated.mockResolvedValue({ items: [child], total: 1 })

      const result = await svc.getPublicBrowse('token', 'sub-folder')
      expect(result).toEqual({
        type: 'folder',
        id: 'sub-folder',
        name: 'sub-folder',
        files: [
          { id: 'child', name: 'nested.txt', type: 'file', mimeType: 'text/plain', size: 50, sizeFormatted: '50.0 B' },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
      })
    })
  })

  describe('isDescendant', () => {
    it('returns true for same id', async () => {
      const result = await svc.isDescendant('f1', 'f1')
      expect(result).toBe(true)
    })

    it('returns true for direct child', async () => {
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'child') return makeFile({ id: 'child', parentId: 'parent', type: 'folder', r2Key: null })
        return null
      })
      const result = await svc.isDescendant('child', 'parent')
      expect(result).toBe(true)
    })

    it('returns true for nested descendant', async () => {
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'grandchild') return makeFile({ id: 'grandchild', parentId: 'child' })
        if (id === 'child') return makeFile({ id: 'child', parentId: 'parent' })
        return null
      })
      const result = await svc.isDescendant('grandchild', 'parent')
      expect(result).toBe(true)
    })

    it('returns false for non-descendant', async () => {
      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'other') return makeFile({ id: 'other', parentId: null })
        return null
      })
      const result = await svc.isDescendant('other', 'unrelated')
      expect(result).toBe(false)
    })
  })

  describe('findShareTokenByDescendant', () => {
    it('returns null for null fileId', async () => {
      const result = await svc.findShareTokenByDescendant(null)
      expect(result).toBeNull()
    })

    it('returns token when the exact file has a share', async () => {
      const share = makeShare({ fileId: 'file-1', token: 't1' })
      shareRepo.findByFileId.mockResolvedValue(share)
      const result = await svc.findShareTokenByDescendant('file-1')
      expect(result).toBe('t1')
    })

    it('walks up parent chain to find ancestor share', async () => {
      const child = makeFile({ id: 'child', parentId: 'parent' })
      const parent = makeFile({ id: 'parent', type: 'folder', r2Key: null })
      const share = makeShare({ fileId: 'parent', token: 'parent-token' })

      fileRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'child') return child
        if (id === 'parent') return parent
        return null
      })
      // No share on child, but there is one on parent
      shareRepo.findByFileId.mockImplementation(async (fileId: string) => {
        if (fileId === 'child') return null
        if (fileId === 'parent') return share
        return null
      })

      const result = await svc.findShareTokenByDescendant('child')
      expect(result).toBe('parent-token')
    })
  })
})
