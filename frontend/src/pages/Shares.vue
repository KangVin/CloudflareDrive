<script setup lang="ts">
import { computed, onMounted, h } from 'vue'
import { NButton, NDataTable, NSpace, NSpin, NEmpty, NIcon, NPopconfirm, NTag, NTooltip, useMessage } from 'naive-ui'
import { TrashOutline, LinkOutline } from '@vicons/ionicons5'
import { useShareStore } from '@/stores/shareStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ShareRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const store = useShareStore()
const settings = useSettingsStore()
const message = useMessage()

onMounted(() => store.loadShares())

function copyToken(token: string) {
  navigator.clipboard.writeText(`${window.location.origin}/s/${token}`)
  message.success(settings.t('shareLinkCopied'))
}

async function handleRevoke(share: ShareRecord) {
  try {
    await store.revoke(share.id)
    message.success(settings.t('revoke'))
  } catch {
    message.error(settings.t('failedToRevoke'))
  }
}

const columns = computed<DataTableColumn<ShareRecord>[]>(() => [
  { title: settings.t('file'), key: 'fileName', minWidth: 180, ellipsis: { tooltip: true } },
  {
    title: settings.t('type'),
    key: 'fileType',
    width: 80,
  },
  {
    title: settings.t('shareLink'),
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
          default: () => settings.t('copy'),
        }),
      ])
    },
  },
  {
    title: settings.t('expires'),
    key: 'expiresAt',
    width: 160,
    render(row) {
      const expiresAt = row.expiresAt
      if (!expiresAt) return h(NTag, { size: 'small', type: 'info' }, () => settings.t('never'))
      const expired = new Date(expiresAt) < new Date()
      return h(NTag, { size: 'small', type: expired ? 'error' : 'warning' }, () =>
        expired ? settings.t('expired') : new Date(expiresAt).toLocaleDateString(),
      )
    },
  },
  {
    title: settings.t('created'),
    key: 'createdAt',
    width: 160,
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    },
  },
  {
    title: settings.t('actions'),
    key: 'actions',
    width: 100,
    render(row) {
      return h(
        NPopconfirm,
        { onPositiveClick: () => handleRevoke(row) },
        {
          default: () => settings.t('revokeConfirm'),
          trigger: () =>
            h(NTooltip, null, {
              trigger: () =>
                h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
              default: () => settings.t('revoke'),
            }),
        },
      )
    },
  },
])
</script>

<template>
  <div style="padding: 16px">
    <h2 style="margin-top: 0">{{ settings.t('shareLinks') }}</h2>
    <NSpin :show="store.loading">
      <div v-if="store.shares.length > 0" class="table-wrap">
        <NDataTable :columns="columns" :data="store.shares" :bordered="false" :single-line="false" />
      </div>
      <NEmpty v-else :description="settings.t('noShareLinks')" />
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
