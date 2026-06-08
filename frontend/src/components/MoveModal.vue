<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NBreadcrumb, NBreadcrumbItem, NModal, NSpace, NSpin, NEmpty, NIcon, useMessage } from 'naive-ui'
import { FolderOpenOutline } from '@vicons/ionicons5'
import { useSettingsStore } from '@/stores/settingsStore'
import { listFiles, updateFile } from '@/api/files'
import { useRequest } from '@/composables/useRequest'
import type { FileRecord } from '@/types'

const props = defineProps<{
  show: boolean
  targets: FileRecord[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  moved: []
}>()

const settings = useSettingsStore()
const message = useMessage()

const moveCurrentFolderId = ref<string | null>(null)
const moveFolderItems = ref<FileRecord[]>([])
const moveLoadingFolders = ref(false)
const moveBreadcrumbs = ref<{ id: string | null; name: string }[]>([])

watch(
  () => props.show,
  (val) => {
    if (val) {
      moveCurrentFolderId.value = null
      moveBreadcrumbs.value = [{ id: null, name: settings.t('root') }]
      loadMoveFolders(null)
    }
  },
)

async function loadMoveFolders(parentId: string | null) {
  moveLoadingFolders.value = true
  try {
    const all = await listFiles(parentId ?? undefined)
    moveFolderItems.value = all.filter((f) => f.type === 'folder')
  } catch {
    message.error(settings.t('failedToLoadFolders'))
  } finally {
    moveLoadingFolders.value = false
  }
}

function navigateMoveFolder(id: string | null) {
  if (id === null) {
    moveBreadcrumbs.value = [{ id: null, name: settings.t('root') }]
    moveCurrentFolderId.value = null
    loadMoveFolders(null)
    return
  }
  const existing = moveBreadcrumbs.value.findIndex((b) => b.id === id)
  if (existing !== -1) {
    moveBreadcrumbs.value = moveBreadcrumbs.value.slice(0, existing + 1)
  } else {
    const folder = moveFolderItems.value.find((f) => f.id === id)
    if (folder) moveBreadcrumbs.value.push({ id: folder.id, name: folder.name })
  }
  moveCurrentFolderId.value = id
  loadMoveFolders(id)
}

const { loading: moveLoading, execute: handleMove } = useRequest(
  async () => {
    if (props.targets.length === 0) return
    for (const file of props.targets) {
      await updateFile(file.id, { parentId: moveCurrentFolderId.value })
    }
    message.success(settings.t('movedSuccessfully'))
    emit('moved')
    emit('update:show', false)
  },
  { lockKey: 'move-files' },
)
</script>

<template>
  <NModal
    :show="show"
    :title="settings.t('moveTo')"
    preset="card"
    style="width: 420px"
    @update:show="(val: boolean) => emit('update:show', val)"
  >
    <NSpace vertical>
      <NBreadcrumb separator="›">
        <NBreadcrumbItem v-for="crumb in moveBreadcrumbs" :key="crumb.id ?? 'root'">
          <a v-if="crumb.id !== moveCurrentFolderId" href="#" @click.prevent="navigateMoveFolder(crumb.id)">
            {{ crumb.id === null ? settings.t('root') : crumb.name }}
          </a>
          <span v-else>{{ crumb.id === null ? settings.t('root') : crumb.name }}</span>
        </NBreadcrumbItem>
      </NBreadcrumb>
      <NSpin :show="moveLoadingFolders">
        <div v-if="moveFolderItems.length > 0" style="max-height: 300px; overflow-y: auto">
          <div
            v-for="folder in moveFolderItems"
            :key="folder.id"
            style="cursor: pointer; padding: 6px 8px; display: flex; align-items: center; gap: 6px"
            @click="navigateMoveFolder(folder.id)"
          >
            <NIcon><FolderOpenOutline /></NIcon>
            {{ folder.name }}
          </div>
        </div>
        <NEmpty v-else :description="settings.t('noSubfolders')" />
      </NSpin>
    </NSpace>
    <template #footer>
      <NButton type="primary" :loading="moveLoading" @click="handleMove">{{ settings.t('moveHere') }}</NButton>
    </template>
  </NModal>
</template>
