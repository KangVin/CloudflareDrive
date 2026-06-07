<script setup lang="ts">
import { computed, onMounted, h } from 'vue'
import { NButton, NDataTable, NSpace, NSpin, NEmpty, NIcon, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { ArrowUndoOutline, TrashOutline } from '@vicons/ionicons5'
import { useTrashStore } from '@/stores/trashStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatSize } from '@/utils/format'
import type { FileRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const store = useTrashStore()
const settings = useSettingsStore()
const message = useMessage()

onMounted(() => store.loadTrashed())

async function handleRestore(file: FileRecord) {
  try {
    await store.restore(file.id)
    message.success(settings.t('restored'))
  } catch {
    message.error(settings.t('failedToRestore'))
  }
}

async function handlePermanentDelete(file: FileRecord) {
  try {
    await store.permanentDelete(file.id)
    message.success(settings.t('deletePermanently'))
  } catch {
    message.error(settings.t('failedToDelete'))
  }
}

const columns = computed<DataTableColumn<FileRecord>[]>(() => [
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
      return h(NSpace, null, [
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
    <NSpin :show="store.loading">
      <div v-if="store.files.length > 0" class="table-wrap">
        <NDataTable :columns="columns" :data="store.files" :bordered="false" :single-line="false" />
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
