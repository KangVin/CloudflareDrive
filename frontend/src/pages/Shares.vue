<script setup lang="ts">
import { onMounted, h } from 'vue'
import { NButton, NDataTable, NSpace, NSpin, NEmpty, NIcon, NPopconfirm, NTag, NTooltip, useMessage } from 'naive-ui'
import { TrashOutline, LinkOutline } from '@vicons/ionicons5'
import { useShareStore } from '@/stores/shareStore'
import type { ShareRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const store = useShareStore()
const message = useMessage()

onMounted(() => store.loadShares())

function copyToken(token: string) {
  navigator.clipboard.writeText(`${window.location.origin}/s/${token}`)
  message.success('Link copied')
}

async function handleRevoke(share: ShareRecord) {
  try {
    await store.revoke(share.id)
    message.success('Share revoked')
  } catch {
    message.error('Failed to revoke')
  }
}

const columns: DataTableColumn<ShareRecord>[] = [
  { title: 'File', key: 'fileName' },
  {
    title: 'Type',
    key: 'fileType',
    width: 80,
  },
  {
    title: 'Share Link',
    key: 'token',
    width: 280,
    render(row) {
      return h(NSpace, null, [
        h(
          'span',
          { style: 'font-family: monospace; font-size: 13px; overflow: hidden; text-overflow: ellipsis' },
          `${window.location.origin}/s/${row.token}`,
        ),
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => copyToken(row.token) }, () =>
              h(NIcon, null, () => h(LinkOutline)),
            ),
          default: () => 'Copy link',
        }),
      ])
    },
  },
  {
    title: 'Expires',
    key: 'expiresAt',
    width: 160,
    render(row) {
      const expiresAt = row.expiresAt
      if (!expiresAt) return h(NTag, { size: 'small', type: 'info' }, () => 'Never')
      const expired = new Date(expiresAt) < new Date()
      return h(NTag, { size: 'small', type: expired ? 'error' : 'warning' }, () =>
        expired ? 'Expired' : new Date(expiresAt).toLocaleDateString(),
      )
    },
  },
  {
    title: 'Created',
    key: 'createdAt',
    width: 160,
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 100,
    render(row) {
      return h(
        NPopconfirm,
        { onPositiveClick: () => handleRevoke(row) },
        {
          default: () => 'Revoke this share link?',
          trigger: () =>
            h(NTooltip, null, {
              trigger: () =>
                h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
              default: () => 'Revoke',
            }),
        },
      )
    },
  },
]
</script>

<template>
  <div style="padding: 16px">
    <h2 style="margin-top: 0">Share Links</h2>
    <NSpin :show="store.loading">
      <NDataTable
        v-if="store.shares.length > 0"
        :columns="columns"
        :data="store.shares"
        :bordered="false"
        :single-line="false"
      />
      <NEmpty v-else description="No share links" />
    </NSpin>
  </div>
</template>
