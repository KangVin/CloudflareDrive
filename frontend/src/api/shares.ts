import type { ShareRecord, PublicShareResult, PublicShareFolder } from '@/types'

const BASE = '/api/v1/shares'

export async function listShares(): Promise<ShareRecord[]> {
  const res = await fetch(BASE)
  if (!res.ok) throw new Error('Failed to list shares')
  return res.json()
}

export async function createShare(fileId: string, expiresAt?: string | null): Promise<ShareRecord> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, expiresAt }),
  })
  if (!res.ok) throw new Error('Failed to create share')
  return res.json()
}

export async function revokeShare(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to revoke share')
}

export async function getPublicShare(token: string): Promise<PublicShareResult> {
  const res = await fetch(`/api/v1/s/${token}`)
  if (!res.ok) throw new Error('Share not found or expired')
  return res.json()
}

export async function getPublicBrowse(token: string, folderId: string): Promise<PublicShareFolder> {
  const res = await fetch(`/api/v1/s/${token}/browse/${folderId}`)
  if (!res.ok) throw new Error('Folder not found')
  return res.json()
}
