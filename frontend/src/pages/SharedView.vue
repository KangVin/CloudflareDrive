<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, NButton, NEmpty, NIcon } from 'naive-ui'
import { DocumentOutline, DownloadOutline, FolderOpenOutline } from '@vicons/ionicons5'
import { getPublicShare } from '@/api/shares'
import { useSettingsStore } from '@/stores/settingsStore'
import type { PublicShareResult, PublicShareFolder } from '@/types'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<PublicShareResult | null>(null)

onMounted(async () => {
  const token = route.params.token as string
  try {
    data.value = await getPublicShare(token)
  } catch {
    error.value = settings.t('shareNotFoundOrExpired')
  } finally {
    loading.value = false
  }
})
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
        <template v-else>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <NIcon><FolderOpenOutline /></NIcon>
            {{ data.name }}
          </h2>
          <div
            v-for="file in (data as PublicShareFolder).files"
            :key="file.id"
            style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eee"
          >
            <NIcon><DocumentOutline /></NIcon>
            <span style="flex: 1">{{ file.name }}</span>
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
