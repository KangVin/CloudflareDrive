<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NModal, NSpace, NSelect, useMessage } from 'naive-ui'
import { useSettingsStore } from '@/stores/settingsStore'
import { useShareStore } from '@/stores/shareStore'
import type { FileRecord } from '@/types'

const props = defineProps<{
  show: boolean
  target: FileRecord | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  shared: []
}>()

const settings = useSettingsStore()
const shareStore = useShareStore()
const message = useMessage()

const shareExpiryDays = ref<number>(0)
const sharingLoading = ref(false)

watch(
  () => props.show,
  (val) => {
    if (val) {
      shareExpiryDays.value = 0
    }
  },
)

async function handleCreateShare() {
  const target = props.target
  if (!target) return
  sharingLoading.value = true
  try {
    let expiresAt: string | null = null
    if (shareExpiryDays.value > 0) {
      const d = new Date()
      d.setDate(d.getDate() + shareExpiryDays.value)
      expiresAt = d.toISOString()
    }
    await shareStore.create(target.id, expiresAt)
    message.success(settings.t('shareLinkCreated'))
    emit('shared')
    emit('update:show', false)
  } catch {
    message.error(settings.t('failedToCreateShareLink'))
  } finally {
    sharingLoading.value = false
  }
}
</script>

<template>
  <NModal
    :show="show"
    :title="settings.t('createShareLink')"
    preset="card"
    style="width: 400px"
    @update:show="(val: boolean) => emit('update:show', val)"
  >
    <p v-if="target" style="margin-top: 0">
      {{ settings.t('shareVerb') }} <strong>{{ target.name }}</strong> {{ settings.t('sharePublicLink') }}
    </p>
    <NSpace vertical>
      <label>{{ settings.t('expiry') }}</label>
      <NSelect
        v-model:value="shareExpiryDays"
        :options="[
          { label: `1 ${settings.t('day')}`, value: 1 },
          { label: `7 ${settings.t('days')}`, value: 7 },
          { label: `30 ${settings.t('days')}`, value: 30 },
          { label: settings.t('never'), value: 0 },
        ]"
        :placeholder="settings.t('expiry')"
      />
    </NSpace>
    <template #footer>
      <NButton type="primary" :disabled="sharingLoading" @click="handleCreateShare">{{
        settings.t('createLink')
      }}</NButton>
    </template>
  </NModal>
</template>
