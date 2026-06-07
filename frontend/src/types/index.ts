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
}

/** Result of a public share lookup */
export interface PublicShareFolder {
  type: 'folder'
  name: string
  files: Array<{
    id: string
    name: string
    type: 'file' | 'folder'
    mimeType: string | null
    size: number
    sizeFormatted: string
  }>
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
