<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { NButton, NCheckbox, NInput, NModal, NSpace, NSelect, useMessage } from 'naive-ui'
import { useSettingsStore } from '@/stores/settingsStore'
import { useShareStore } from '@/stores/shareStore'
import { useRequest } from '@/composables/useRequest'
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
const enablePassword = ref(false)
const sharePassword = ref('')

watch(
  () => props.show,
  (val) => {
    if (val) {
      shareExpiryDays.value = 0
      enablePassword.value = false
      sharePassword.value = ''
    }
  },
)

const MIN_PASSWORD_LENGTH = 4
const MAX_PASSWORD_LENGTH = 128

const passwordValid = computed(() => {
  if (!enablePassword.value) return true
  return sharePassword.value.length >= MIN_PASSWORD_LENGTH && sharePassword.value.length <= MAX_PASSWORD_LENGTH
})

const { loading: sharingLoading, execute: handleCreateShare } = useRequest(
  async () => {
    const target = props.target
    if (!target) return
    let expiresAt: string | null = null
    if (shareExpiryDays.value > 0) {
      const d = new Date()
      d.setDate(d.getDate() + shareExpiryDays.value)
      expiresAt = d.toISOString()
    }
    await shareStore.create(target.id, expiresAt, enablePassword.value ? sharePassword.value : undefined)
    message.success(settings.t('shareLinkCreated'))
    emit('shared')
    emit('update:show', false)
  },
  { lockKey: 'create-share' },
)
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
    <NSpace vertical style="margin-top: 12px">
      <NCheckbox v-model:checked="enablePassword">
        {{ settings.t('setPassword') }}
      </NCheckbox>
      <NInput
        v-if="enablePassword"
        v-model:value="sharePassword"
        type="password"
        show-password-on="click"
        :placeholder="settings.t('passwordPlaceholder')"
        :status="sharePassword && !passwordValid ? 'error' : undefined"
      />
      <span v-if="enablePassword && sharePassword && !passwordValid" style="color: #e88080; font-size: 12px">
        {{ settings.t('passwordLengthHint') }} {{ MIN_PASSWORD_LENGTH }}-{{ MAX_PASSWORD_LENGTH }}
      </span>
    </NSpace>
    <template #footer>
      <NButton type="primary" :loading="sharingLoading" :disabled="!passwordValid" @click="handleCreateShare">{{
        settings.t('createLink')
      }}</NButton>
    </template>
  </NModal>
</template>
