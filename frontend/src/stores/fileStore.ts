import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FileRecord } from '@/types'
import * as api from '@/api/files'

export const useFileStore = defineStore('files', () => {
  const currentFolderId = ref<string | null>(null)
  const files = ref<FileRecord[]>([])
  const breadcrumbs = ref<{ id: string | null; name: string }[]>([])

  const currentFiles = computed(() => files.value)
  const currentBreadcrumbs = computed(() => breadcrumbs.value)

  async function loadFolder(folderId: string | null) {
    currentFolderId.value = folderId
    files.value = await api.listFiles(folderId ?? undefined)
    await buildBreadcrumbs(folderId)
  }

  async function buildBreadcrumbs(folderId: string | null) {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: '' }]
    let current = folderId
    const stack: { id: string | null; name: string }[] = []
    while (current) {
      const folder = await api.getFile(current)
      stack.unshift({ id: folder.id, name: folder.name })
      current = folder.parentId
    }
    crumbs.push(...stack)
    breadcrumbs.value = crumbs
  }

  async function createFolder(name: string) {
    await api.createFolder(name, currentFolderId.value)
    await loadFolder(currentFolderId.value)
  }

  async function renameFile(id: string, name: string) {
    await api.updateFile(id, { name })
    await loadFolder(currentFolderId.value)
  }

  async function deleteFile(id: string) {
    await api.trashFile(id)
    await loadFolder(currentFolderId.value)
  }

  return {
    currentFolderId,
    files,
    breadcrumbs,
    currentFiles,
    currentBreadcrumbs,
    loadFolder,
    createFolder,
    renameFile,
    deleteFile,
  }
})
