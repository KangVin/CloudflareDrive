/** File or folder metadata stored in D1 */
export interface FileRecord {
  id: string
  name: string
  parentId: string | null
  type: 'file' | 'folder'
  mimeType: string | null
  size: number
  hash: string | null
  r2Key: string | null
  isTrashed: boolean
  createdAt: string
  updatedAt: string
}

/** Fields for creating a new file or folder record */
export interface CreateFileInput {
  name: string
  parentId: string | null
  type: 'file' | 'folder'
  mimeType: string | null
  size: number
  hash?: string | null
  r2Key: string | null
}

/** Fields for updating an existing file or folder */
export interface UpdateFileInput {
  name?: string
  parentId?: string | null
  mimeType?: string | null
  size?: number
  hash?: string | null
  r2Key?: string | null
}

/** Share link record stored in D1 */
export interface ShareRecord {
  id: string
  fileId: string
  token: string
  expiresAt: string | null
  createdAt: string
}

/** Fields for creating a new share link */
export interface CreateShareInput {
  fileId: string
  token: string
  expiresAt: string | null
}
