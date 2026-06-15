import type { ShareRecord, PublicShareResult, PublicShareFolder, VerifyTokenResponse } from '@/types'
import { fetchJson, fetchVoid } from './client'

const BASE = '/api/v1/shares'

function authHeaders(verifyToken?: string): Record<string, string> {
  return verifyToken ? { 'X-Verify-Token': verifyToken } : {}
}

export async function listShares(): Promise<ShareRecord[]> {
  return fetchJson(BASE, undefined, 'Failed to list shares')
}

export async function createShare(fileId: string, expiresAt?: string | null, password?: string): Promise<ShareRecord> {
  return fetchJson(
    BASE,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, expiresAt, password }),
    },
    'Failed to create share',
  )
}

export async function revokeShare(id: string): Promise<void> {
  return fetchVoid(`${BASE}/${id}`, { method: 'DELETE' }, 'Failed to revoke share')
}

export async function verifySharePassword(token: string, password: string): Promise<VerifyTokenResponse> {
  return fetchJson(
    `/api/v1/s/${token}/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
    'Verification failed',
  )
}

export async function getPublicShare(
  token: string,
  page = 1,
  pageSize = 50,
  verifyToken?: string,
): Promise<PublicShareResult> {
  return fetchJson(
    `/api/v1/s/${token}?page=${page}&pageSize=${pageSize}`,
    { headers: authHeaders(verifyToken) },
    'Share not found or expired',
  )
}

export async function getPublicBrowse(
  token: string,
  folderId: string,
  page = 1,
  pageSize = 50,
  verifyToken?: string,
): Promise<PublicShareFolder> {
  return fetchJson(
    `/api/v1/s/${token}/browse/${folderId}?page=${page}&pageSize=${pageSize}`,
    { headers: authHeaders(verifyToken) },
    'Folder not found',
  )
}
