<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { NModal, NSpin, NEmpty, useMessage } from 'naive-ui'
import { useSettingsStore } from '@/stores/settingsStore'
import { IMAGE_TYPES, TEXT_TYPES, VIDEO_TYPES, AUDIO_TYPES } from '@/utils/constants'
import type { FileRecord } from '@/types'

const props = defineProps<{
  show: boolean
  file: FileRecord | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const settings = useSettingsStore()
const message = useMessage()

const previewContent = ref<string | null>(null)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)
const mediaUrl = ref<string | null>(null)
const isVideo = ref(false)
const isAudio = ref(false)

const modalWidth = computed(() => (isVideo.value ? '80vw' : '800px'))
const modalStyle = computed(() => ({
  width: modalWidth.value,
  'max-width': isVideo.value ? '1200px' : '800px',
  'max-height': '90vh',
}))

watch(
  () => props.show,
  async (val) => {
    if (val && props.file) {
      const file = props.file
      previewContent.value = null
      previewUrl.value = null
      mediaUrl.value = null
      isVideo.value = false
      isAudio.value = false
      previewLoading.value = true
      try {
        const mime = file.mimeType || ''
        if (VIDEO_TYPES.includes(mime)) {
          mediaUrl.value = `/api/v1/files/${file.id}/media`
          isVideo.value = true
          previewLoading.value = false
          return
        }
        if (AUDIO_TYPES.includes(mime)) {
          mediaUrl.value = `/api/v1/files/${file.id}/media`
          isAudio.value = true
          previewLoading.value = false
          return
        }
        const res = await fetch(`/api/v1/files/${file.id}/download`)
        if (!res.ok) throw new Error('Download failed')
        if (!props.show || props.file?.id !== file.id) return
        if (IMAGE_TYPES.includes(mime)) {
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          if (!props.show || props.file?.id !== file.id) {
            URL.revokeObjectURL(blobUrl)
            return
          }
          previewUrl.value = blobUrl
        } else if (TEXT_TYPES.includes(mime) || mime.startsWith('text/')) {
          previewContent.value = await res.text()
        }
      } catch {
        message.error(settings.t('failedToLoadPreview'))
      } finally {
        if (!mediaUrl.value) previewLoading.value = false
      }
    } else if (!val) {
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
      previewContent.value = null
      mediaUrl.value = null
      isVideo.value = false
      isAudio.value = false
      previewLoading.value = false
    }
  },
)

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <NModal
    :show="show"
    :title="file?.name ?? settings.t('preview')"
    preset="card"
    :style="modalStyle"
    @update:show="(val: boolean) => emit('update:show', val)"
  >
    <NSpin :show="previewLoading">
      <div v-if="mediaUrl && isVideo" style="text-align: center">
        <video :src="mediaUrl" controls autoplay style="max-width: 100%; max-height: 70vh; border-radius: 4px">
          {{ settings.t('previewNotAvailable') }}
        </video>
      </div>
      <div v-else-if="mediaUrl && isAudio" style="text-align: center; padding: 40px 0">
        <audio :src="mediaUrl" controls autoplay style="width: 100%; max-width: 400px" />
      </div>
      <div v-else-if="previewUrl" style="text-align: center">
        <img :src="previewUrl" alt="Preview" style="max-width: 100%; max-height: 70vh; object-fit: contain" />
      </div>
      <pre
        v-else-if="previewContent !== null"
        style="max-height: 70vh; overflow: auto; white-space: pre-wrap; word-break: break-all; margin: 0"
        >{{ previewContent }}</pre
      >
      <NEmpty v-else-if="!previewLoading && !mediaUrl" :description="settings.t('previewNotAvailable')" />
    </NSpin>
  </NModal>
</template>
