import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ShareRecord } from '@/types'
import * as api from '@/api/shares'

export const useShareStore = defineStore('shares', () => {
  const shares = ref<ShareRecord[]>([])
  const loading = ref(false)

  async function loadShares() {
    loading.value = true
    try {
      shares.value = await api.listShares()
    } finally {
      loading.value = false
    }
  }

  async function create(fileId: string, expiresAt?: string | null) {
    await api.createShare(fileId, expiresAt)
    await loadShares()
  }

  async function revoke(id: string) {
    await api.revokeShare(id)
    await loadShares()
  }

  async function batchRevoke(ids: string[]) {
    for (const id of ids) {
      await api.revokeShare(id)
    }
    await loadShares()
  }

  return { shares, loading, loadShares, create, revoke, batchRevoke }
})
