<script setup lang="ts">
import { onMounted, h } from 'vue'
import { NButton, NDataTable, NSpace, NSpin, NEmpty, NIcon, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { ArrowUndoOutline, TrashOutline } from '@vicons/ionicons5'
import { useTrashStore } from '@/stores/trashStore'
import { formatSize } from '@/utils/format'
import type { FileRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const store = useTrashStore()
const message = useMessage()

onMounted(() => store.loadTrashed())

async function handleRestore(file: FileRecord) {
  try {
    await store.restore(file.id)
    message.success('Restored')
  } catch {
    message.error('Failed to restore')
  }
}

async function handlePermanentDelete(file: FileRecord) {
  try {
    await store.permanentDelete(file.id)
    message.success('Permanently deleted')
  } catch {
    message.error('Failed to delete')
  }
}

const columns: DataTableColumn<FileRecord>[] = [
  { title: 'Name', key: 'name' },
  {
    title: 'Size',
    key: 'size',
    width: 100,
    render(row) {
      return row.type === 'folder' ? '-' : formatSize(row.size)
    },
  },
  { title: 'Type', key: 'type', width: 80 },
  {
    title: 'Deleted at',
    key: 'updatedAt',
    width: 180,
    render(row) {
      return new Date(row.updatedAt).toLocaleString()
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 140,
    render(row) {
      return h(NSpace, null, [
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleRestore(row) }, () =>
              h(NIcon, null, () => h(ArrowUndoOutline)),
            ),
          default: () => 'Restore',
        }),
        h(
          NPopconfirm,
          { onPositiveClick: () => handlePermanentDelete(row) },
          {
            default: () => 'Delete permanently?',
            trigger: () =>
              h(NTooltip, null, {
                trigger: () =>
                  h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
                default: () => 'Delete',
              }),
          },
        ),
      ])
    },
  },
]
</script>

<template>
  <div style="padding: 16px">
    <h2 style="margin-top: 0">Trash</h2>
    <NSpin :show="store.loading">
      <NDataTable
        v-if="store.files.length > 0"
        :columns="columns"
        :data="store.files"
        :bordered="false"
        :single-line="false"
      />
      <NEmpty v-else description="Trash is empty" />
    </NSpin>
  </div>
</template>
