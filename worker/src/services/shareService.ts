import type { CreateShareInput, FileRecord } from '../types/models'
import type { createFileRepository } from '../repositories/fileRepository'
import type { createShareRepository } from '../repositories/shareRepository'

type ShareRepo = ReturnType<typeof createShareRepository>
type FileRepo = ReturnType<typeof createFileRepository>

const VERIFY_TOKEN_TTL = 7200 // 2 hours in seconds
const MIN_PASSWORD_LENGTH = 4
const MAX_PASSWORD_LENGTH = 128

/** SHA-256 hash a password with a salt */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(salt + password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** HMAC-SHA256 sign a payload */
async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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

export function createShareService(shareRepo: ShareRepo, fileRepo: FileRepo, secret: string) {
  async function list() {
    const shares = await shareRepo.findAll()
    return await Promise.all(
      shares.map(async (share) => {
        const path = await buildPath(share.fileId)
        const { passwordSalt: _, ...rest } = share
        return { ...rest, path }
      }),
    )
  }

  /** Walk up the parent chain to build the directory path from root to parent of the file */
  async function buildPath(fileId: string): Promise<string | null> {
    const parts: string[] = []
    let currentId: string | null = fileId
    while (currentId) {
      const file = await fileRepo.findById(currentId)
      if (!file) break
      parts.unshift(file.name)
      currentId = file.parentId
    }
    // Remove the file name itself, keep only parent directory path
    parts.pop()
    return parts.length > 0 ? parts.join('/') : null
  }

  async function create(fileId: string, expiresAt: string | null, password?: string) {
    const file = await fileRepo.findById(fileId)
    if (!file) throw new Error('File not found')
    const token = crypto.randomUUID()
    let passwordHash: string | null = null
    let passwordSalt: string | null = null
    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        throw new Error(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`)
      }
      passwordSalt = crypto.randomUUID()
      passwordHash = await hashPassword(password, passwordSalt)
    }
    const input: CreateShareInput = { fileId, token, expiresAt, passwordHash, passwordSalt }
    return await shareRepo.create(input)
  }

  /** Verify a share password and return a stateless verify token */
  async function verifySharePassword(token: string, password: string): Promise<string> {
    const share = await shareRepo.findByToken(token)
    if (!share) throw new Error('Not found')
    if (!share.passwordHash || !share.passwordSalt) throw new Error('No password required')

    const hash = await hashPassword(password, share.passwordSalt)
    if (hash !== share.passwordHash) throw new Error('Wrong password')

    const expiresAt = Math.floor(Date.now() / 1000) + VERIFY_TOKEN_TTL
    const payload = `${token}::${expiresAt}`
    const signature = await hmacSign(payload, secret)
    return btoa(`${payload}::${signature}`)
  }

  /** Check whether a share requires a password */
  async function checkRequiresPassword(token: string): Promise<boolean> {
    const share = await shareRepo.findByToken(token)
    return share !== null && share.passwordHash !== null
  }

  /** Validate an HMAC-signed verify token */
  async function validateVerifyToken(shareToken: string, verifyToken: string): Promise<boolean> {
    try {
      const decoded = atob(verifyToken)
      const sepIdx = decoded.lastIndexOf('::')
      if (sepIdx === -1) return false
      const payload = decoded.substring(0, sepIdx)
      const signature = decoded.substring(sepIdx + 2)

      const expected = await hmacSign(payload, secret)
      if (signature !== expected) return false

      const parts = payload.split('::')
      if (parts.length < 2) return false
      const token = parts[0]
      const expiresAt = parseInt(parts[parts.length - 1], 10)
      if (token !== shareToken) return false
      if (Math.floor(Date.now() / 1000) > expiresAt) return false

      return true
    } catch {
      return false
    }
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

  const DEFAULT_PAGE_SIZE = 50

  /** Map a file record to a public share file item */
  function toFileItem(c: FileRecord) {
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      mimeType: c.mimeType,
      size: c.size,
      sizeFormatted: c.type === 'file' ? formatSize(c.size) : '-',
    }
  }

  async function getPublic(token: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    const share = await shareRepo.findByToken(token)
    if (!share) return null
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) return null
    const file = await fileRepo.findById(share.fileId)
    if (!file || file.isTrashed) return null
    if (file.type === 'folder') {
      const result = await fileRepo.findByParentPaginated(file.id, page, pageSize)
      return {
        type: 'folder' as const,
        id: file.id,
        name: file.name,
        files: result.items.map(toFileItem),
        total: result.total,
        page,
        pageSize,
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

  async function getPublicBrowse(token: string, folderId: string, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
    const share = await shareRepo.findByToken(token)
    if (!share) return null
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) return null
    if (!(await isDescendant(folderId, share.fileId))) return null
    const folder = await fileRepo.findById(folderId)
    if (!folder || folder.isTrashed || folder.type !== 'folder') return null
    const result = await fileRepo.findByParentPaginated(folderId, page, pageSize)
    return {
      type: 'folder' as const,
      id: folder.id,
      name: folder.name,
      files: result.items.map(toFileItem),
      total: result.total,
      page,
      pageSize,
    }
  }

  /** Walk up parent chain to find if any ancestor has a share record, return the token */
  async function findShareTokenByDescendant(fileId: string | null): Promise<string | null> {
    let currentId: string | null = fileId
    while (currentId) {
      const share = await shareRepo.findByFileId(currentId)
      if (share) return share.token
      const current = await fileRepo.findById(currentId)
      currentId = current?.parentId ?? null
    }
    return null
  }

  return {
    list,
    create,
    revoke,
    getPublic,
    getPublicBrowse,
    isDescendant,
    findShareTokenByDescendant,
    verifySharePassword,
    checkRequiresPassword,
    validateVerifyToken,
  }
}
