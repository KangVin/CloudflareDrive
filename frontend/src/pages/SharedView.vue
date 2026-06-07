<script setup lang="ts">
import { ref, shallowRef, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, NButton, NEmpty, NIcon, useMessage } from 'naive-ui'
import { DocumentOutline, DownloadOutline, FolderOpenOutline, ArrowBackOutline } from '@vicons/ionicons5'
import { getPublicShare, getPublicBrowse } from '@/api/shares'
import { useSettingsStore } from '@/stores/settingsStore'
import type { PublicShareResult, PublicShareFolder, PublicShareFileItem } from '@/types'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const message = useMessage()
const loading = ref(true)
const error = ref<string | null>(null)
const data = shallowRef<PublicShareResult | null>(null)

/** Stack of previous folder views for back navigation: each entry contains the folder data to restore */
const folderStack = shallowRef<Array<{ id: string; name: string; files: PublicShareFileItem[] }>>([])

/** Currently displayed folder data (for folder-type shares) */
const currentFolder = shallowRef<PublicShareFolder | null>(null)

async function loadRoot() {
  loading.value = true
  const token = route.params.token as string
  try {
    const result = await getPublicShare(token)
    data.value = result
    if (result.type === 'folder') {
      currentFolder.value = result
      folderStack.value = []
    }
  } catch {
    error.value = settings.t('shareNotFoundOrExpired')
  } finally {
    loading.value = false
  }
}

async function openFolder(folderId: string, _folderName: string) {
  loading.value = true
  const token = route.params.token as string
  try {
    const result = await getPublicBrowse(token, folderId)
    const cur = currentFolder.value
    if (cur) {
      folderStack.value = [...folderStack.value, { id: cur.id, name: cur.name, files: cur.files }]
    }
    currentFolder.value = result
  } catch (e) {
    message.error(e instanceof Error ? e.message : settings.t('failedToLoadFolders'))
  } finally {
    loading.value = false
  }
}

function goBack() {
  const prev = folderStack.value.pop()
  if (prev) {
    currentFolder.value = { type: 'folder', id: prev.id, name: prev.name, files: prev.files }
    folderStack.value = [...folderStack.value]
  }
}

onMounted(loadRoot)
</script>

<template>
  <div style="max-width: 720px; margin: 40px auto; padding: 0 16px">
    <NSpin :show="loading">
      <div v-if="data">
        <template v-if="data.type === 'file'">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px">
            <NIcon size="48"><DocumentOutline /></NIcon>
            <div>
              <h2 style="margin: 0 0 4px">{{ data.name }}</h2>
              <span style="color: #888">{{ data.sizeFormatted }} · {{ data.mimeType }}</span>
            </div>
          </div>
          <NButton type="primary" :href="data.downloadUrl" tag="a" target="_blank">
            <template #icon
              ><NIcon><DownloadOutline /></NIcon
            ></template>
            {{ settings.t('download') }}
          </NButton>
        </template>
        <template v-else-if="currentFolder">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
            <NButton v-if="folderStack.length > 0" quaternary size="small" @click="goBack">
              <template #icon
                ><NIcon><ArrowBackOutline /></NIcon
              ></template>
            </NButton>
            <h2 style="margin: 0; display: flex; align-items: center; gap: 8px">
              <NIcon><FolderOpenOutline /></NIcon>
              {{ currentFolder.name }}
            </h2>
          </div>
          <div
            v-for="file in currentFolder.files"
            :key="file.id"
            style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eee"
          >
            <NIcon>
              <FolderOpenOutline v-if="file.type === 'folder'" style="color: #f0ad4e" />
              <DocumentOutline v-else />
            </NIcon>
            <span
              :style="{ flex: 1, cursor: file.type === 'folder' ? 'pointer' : 'default', userSelect: 'none' }"
              @click="file.type === 'folder' && openFolder(file.id, file.name)"
            >
              {{ file.name }}
            </span>
            <span style="color: #888">{{ file.sizeFormatted }}</span>
            <NButton
              v-if="file.type === 'file'"
              size="tiny"
              :href="`/api/v1/s/${route.params.token}/download/${file.id}`"
              tag="a"
              target="_blank"
            >
              <template #icon
                ><NIcon><DownloadOutline /></NIcon
              ></template>
              {{ settings.t('download') }}
            </NButton>
          </div>
        </template>
      </div>
      <NEmpty v-else-if="!loading" :description="error ?? settings.t('noContent')">
        <template #extra>
          <NButton @click="router.push('/')">{{ settings.t('goHome') }}</NButton>
        </template>
      </NEmpty>
    </NSpin>
  </div>
</template>
