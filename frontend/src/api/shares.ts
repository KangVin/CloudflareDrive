import type { ShareRecord, PublicShareResult, PublicShareFolder } from '@/types'
import { fetchJson, fetchVoid } from './client'

const BASE = '/api/v1/shares'

export async function listShares(): Promise<ShareRecord[]> {
  return fetchJson(BASE, undefined, 'Failed to list shares')
}

export async function createShare(fileId: string, expiresAt?: string | null): Promise<ShareRecord> {
  return fetchJson(
    BASE,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, expiresAt }),
    },
    'Failed to create share',
  )
}

export async function revokeShare(id: string): Promise<void> {
  return fetchVoid(`${BASE}/${id}`, { method: 'DELETE' }, 'Failed to revoke share')
}

export async function getPublicShare(token: string, page = 1, pageSize = 50): Promise<PublicShareResult> {
  return fetchJson(`/api/v1/s/${token}?page=${page}&pageSize=${pageSize}`, undefined, 'Share not found or expired')
}

export async function getPublicBrowse(
  token: string,
  folderId: string,
  page = 1,
  pageSize = 50,
): Promise<PublicShareFolder> {
  return fetchJson(
    `/api/v1/s/${token}/browse/${folderId}?page=${page}&pageSize=${pageSize}`,
    undefined,
    'Folder not found',
  )
}
