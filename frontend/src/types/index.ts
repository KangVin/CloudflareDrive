/** File or folder metadata returned from the API */
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

/** Share link record returned from the API */
export interface ShareRecord {
  id: string
  fileId: string
  token: string
  expiresAt: string | null
  createdAt: string
  fileName: string
  fileType: 'file' | 'folder'
  parentName: string | null
}

/** File/folder item within a shared folder listing */
export interface PublicShareFileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  mimeType: string | null
  size: number
  sizeFormatted: string
}

/** Result of a public share lookup */
export interface PublicShareFolder {
  type: 'folder'
  id: string
  name: string
  files: PublicShareFileItem[]
  total: number
  page: number
  pageSize: number
}

export interface PublicShareFile {
  type: 'file'
  name: string
  mimeType: string | null
  size: number
  sizeFormatted: string
  downloadUrl: string
}

export type PublicShareResult = PublicShareFolder | PublicShareFile
