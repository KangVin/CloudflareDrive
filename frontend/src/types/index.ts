/** File or folder metadata returned from the API */
export interface FileRecord {
  id: string
  name: string
  parentId: string | null
  type: 'file' | 'folder'
  mimeType: string | null
  size: number
  r2Key: string | null
  isTrashed: boolean
  createdAt: string
  updatedAt: string
}
