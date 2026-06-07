import type { CreateShareInput } from '../types/models'
import type { createFileRepository } from '../repositories/fileRepository'
import type { createShareRepository } from '../repositories/shareRepository'

type ShareRepo = ReturnType<typeof createShareRepository>
type FileRepo = ReturnType<typeof createFileRepository>

/** Human-readable file size format */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

export function createShareService(shareRepo: ShareRepo, fileRepo: FileRepo) {
  async function list() {
    return await shareRepo.findAll()
  }

  async function create(fileId: string, expiresAt: string | null) {
    const file = await fileRepo.findById(fileId)
    if (!file) throw new Error('File not found')
    const token = crypto.randomUUID()
    const input: CreateShareInput = { fileId, token, expiresAt }
    return await shareRepo.create(input)
  }

  async function revoke(id: string) {
    await shareRepo.remove(id)
  }

  /** Walk up the parent chain to check if folderId is a descendant of ancestorId */
  async function isDescendant(folderId: string, ancestorId: string): Promise<boolean> {
    if (folderId === ancestorId) return true
    let currentId: string | null = folderId
    while (currentId) {
      if (currentId === ancestorId) return true
      const current = await fileRepo.findById(currentId)
      currentId = current?.parentId ?? null
    }
    return false
  }

  async function getPublic(token: string) {
    const share = await shareRepo.findByToken(token)
    if (!share) return null
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) return null
    const file = await fileRepo.findById(share.fileId)
    if (!file || file.isTrashed) return null
    if (file.type === 'folder') {
      const children = await fileRepo.findByParent(file.id)
      return {
        type: 'folder' as const,
        id: file.id,
        name: file.name,
        files: children.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          mimeType: c.mimeType,
          size: c.size,
          sizeFormatted: c.type === 'file' ? formatSize(c.size) : '-',
        })),
      }
    }
    return {
      type: 'file' as const,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      sizeFormatted: formatSize(file.size),
      downloadUrl: `/api/v1/s/${token}/download`,
    }
  }

  async function getPublicBrowse(token: string, folderId: string) {
    const share = await shareRepo.findByToken(token)
    if (!share) return null
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) return null
    if (!(await isDescendant(folderId, share.fileId))) return null
    const folder = await fileRepo.findById(folderId)
    if (!folder || folder.isTrashed || folder.type !== 'folder') return null
    const children = await fileRepo.findByParent(folderId)
    return {
      type: 'folder' as const,
      id: folder.id,
      name: folder.name,
      files: children.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        mimeType: c.mimeType,
        size: c.size,
        sizeFormatted: c.type === 'file' ? formatSize(c.size) : '-',
      })),
    }
  }

  return { list, create, revoke, getPublic, getPublicBrowse }
}
