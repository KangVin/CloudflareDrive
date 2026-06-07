<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { NButton, NDataTable, NSpace, NSpin, NEmpty, NIcon, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { ArrowUndoOutline, TrashOutline } from '@vicons/ionicons5'
import { useTrashStore } from '@/stores/trashStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatSize } from '@/utils/format'
import type { FileRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const DEFAULT_PAGE_SIZE = 50
const tablePagination = { pageSize: DEFAULT_PAGE_SIZE }

const store = useTrashStore()
const settings = useSettingsStore()
const message = useMessage()

const checkedRowKeys = ref<string[]>([])
const selectedFiles = computed(() => store.files.filter((file) => checkedRowKeys.value.includes(file.id)))

onMounted(async () => {
  try {
    await store.loadTrashed()
  } catch (e) {
    message.error(e instanceof Error ? e.message : settings.t('failedToLoadFolders'))
  }
})

async function handleRestore(file: FileRecord) {
  try {
    await store.restore(file.id)
    checkedRowKeys.value = checkedRowKeys.value.filter((id) => id !== file.id)
    message.success(settings.t('restored'))
  } catch {
    message.error(settings.t('failedToRestore'))
  }
}

async function handlePermanentDelete(file: FileRecord) {
  try {
    await store.permanentDelete(file.id)
    checkedRowKeys.value = checkedRowKeys.value.filter((id) => id !== file.id)
    message.success(settings.t('deletePermanently'))
  } catch {
    message.error(settings.t('failedToDelete'))
  }
}

async function handleBatchRestore() {
  if (selectedFiles.value.length === 0) return
  try {
    await store.batchRestore(selectedFiles.value.map((f) => f.id))
    checkedRowKeys.value = []
    message.success(settings.t('restored'))
  } catch {
    message.error(settings.t('failedToRestore'))
  }
}

async function handleBatchDelete() {
  if (selectedFiles.value.length === 0) return
  try {
    await store.batchPermanentDelete(selectedFiles.value.map((f) => f.id))
    checkedRowKeys.value = []
    message.success(settings.t('deletePermanently'))
  } catch {
    message.error(settings.t('failedToDelete'))
  }
}

async function handleEmptyTrash() {
  try {
    await store.emptyTrash()
    checkedRowKeys.value = []
    message.success(settings.t('emptyTrashDone'))
  } catch {
    message.error(settings.t('failedToDelete'))
  }
}

const columns = computed<DataTableColumn<FileRecord>[]>(() => [
  { type: 'selection' },
  { title: settings.t('name'), key: 'name', minWidth: 180, ellipsis: { tooltip: true }, sorter: true },
  {
    title: settings.t('size'),
    key: 'size',
    width: 100,
    sorter: (a, b) => a.size - b.size,
    render(row) {
      return row.type === 'folder' ? '-' : formatSize(row.size)
    },
  },
  { title: settings.t('type'), key: 'type', width: 80, sorter: true },
  {
    title: settings.t('deletedAt'),
    key: 'updatedAt',
    width: 180,
    sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
    render(row) {
      return new Date(row.updatedAt).toLocaleString()
    },
  },
  {
    title: settings.t('actions'),
    key: 'actions',
    width: 140,
    render(row) {
      return h(NSpace, null, () => [
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleRestore(row) }, () =>
              h(NIcon, null, () => h(ArrowUndoOutline)),
            ),
          default: () => settings.t('restore'),
        }),
        h(
          NPopconfirm,
          { onPositiveClick: () => handlePermanentDelete(row) },
          {
            default: () => settings.t('deletePermanentlyConfirm'),
            trigger: () =>
              h(NTooltip, null, {
                trigger: () =>
                  h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
                default: () => settings.t('delete'),
              }),
          },
        ),
      ])
    },
  },
])
</script>

<template>
  <div style="padding: 16px">
    <h2 style="margin-top: 0">{{ settings.t('trash') }}</h2>
    <NSpace v-if="checkedRowKeys.length > 0" style="margin-bottom: 12px" align="center">
      <span>{{ checkedRowKeys.length }} {{ settings.t('selected') }}</span>
      <NButton size="small" @click="handleBatchRestore">{{ settings.t('restore') }}</NButton>
      <NPopconfirm @positive-click="handleBatchDelete">
        <template #trigger>
          <NButton size="small" type="error">{{ settings.t('delete') }}</NButton>
        </template>
        {{ settings.t('deleteSelectedConfirm') }}
      </NPopconfirm>
    </NSpace>
    <NSpace v-else-if="store.files.length > 0" style="margin-bottom: 12px" align="center">
      <NPopconfirm @positive-click="handleEmptyTrash">
        <template #trigger>
          <NButton size="small" type="error">{{ settings.t('emptyTrash') }}</NButton>
        </template>
        {{ settings.t('emptyTrashConfirm') }}
      </NPopconfirm>
    </NSpace>
    <NSpin :show="store.loading">
      <div v-if="store.files.length > 0" class="table-wrap">
        <NDataTable
          v-model:checked-row-keys="checkedRowKeys"
          :columns="columns"
          :data="store.files"
          :bordered="false"
          :single-line="false"
          :row-key="(row: FileRecord) => row.id"
          :pagination="tablePagination"
        />
      </div>
      <NEmpty v-else :description="settings.t('noFilesYet')" />
    </NSpin>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .table-wrap {
    overflow-x: auto;
  }
}
</style>
