<script setup lang="ts">
import { NButton, NSpace, NProgress } from 'naive-ui'
import { useSettingsStore } from '@/stores/settingsStore'
import type { UploadTask } from '@/composables/useUpload'

defineProps<{
  tasks: UploadTask[]
}>()

const emit = defineEmits<{
  clearFinished: []
}>()

const settings = useSettingsStore()

function getProgressStatus(task: UploadTask): 'default' | 'success' | 'error' {
  if (task.status === 'success') return 'success'
  if (task.status === 'error') return 'error'
  return 'default'
}
</script>

<template>
  <div v-if="tasks.length > 0" class="upload-queue">
    <NSpace align="center" justify="space-between" style="margin-bottom: 8px">
      <strong>{{ settings.t('uploadQueue') }}</strong>
      <NButton size="tiny" @click="emit('clearFinished')">{{ settings.t('clearFinished') }}</NButton>
    </NSpace>
    <NSpace vertical size="small">
      <div v-for="task in tasks" :key="task.id">
        <NSpace align="center" justify="space-between">
          <span class="upload-task-name">{{ task.name }}</span>
          <span>{{
            task.status === 'hashing'
              ? settings.t('hashing')
              : task.status === 'uploading'
                ? settings.t('uploading')
                : `${task.percent}%`
          }}</span>
        </NSpace>
        <NProgress type="line" :percentage="task.percent" :status="getProgressStatus(task)" :show-indicator="false" />
      </div>
    </NSpace>
  </div>
</template>

<style scoped>
.upload-queue {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
}

.upload-task-name {
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .upload-task-name {
    max-width: 55%;
  }
}
</style>
