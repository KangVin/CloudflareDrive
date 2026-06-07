import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileRecord } from '@/types'
import * as api from '@/api/trash'

export const useTrashStore = defineStore('trash', () => {
  const files = ref<FileRecord[]>([])
  const loading = ref(false)

  async function loadTrashed() {
    loading.value = true
    try {
      files.value = await api.listTrashed()
    } finally {
      loading.value = false
    }
  }

  async function restore(id: string) {
    await api.restoreFile(id)
    await loadTrashed()
  }

  async function permanentDelete(id: string) {
    await api.permanentDelete(id)
    await loadTrashed()
  }

  async function batchRestore(ids: string[]) {
    for (const id of ids) {
      await api.restoreFile(id)
    }
    await loadTrashed()
  }

  async function batchPermanentDelete(ids: string[]) {
    for (const id of ids) {
      await api.permanentDelete(id)
    }
    await loadTrashed()
  }

  async function emptyTrash() {
    await api.emptyTrash()
    await loadTrashed()
  }

  return { files, loading, loadTrashed, restore, permanentDelete, batchRestore, batchPermanentDelete, emptyTrash }
})
