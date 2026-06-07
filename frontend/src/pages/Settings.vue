<script setup lang="ts">
import { NSwitch, NSpace, NIcon, NSelect, useMessage } from 'naive-ui'
import { MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { useSettingsStore } from '@/stores/settingsStore'

const store = useSettingsStore()
const message = useMessage()
const languageOptions = [
  { label: '简体中文', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: 'Русский', value: 'ru' },
]

function handleToggle() {
  store.toggleTheme()
  message.success(store.isDark ? store.t('darkMode') : store.t('lightMode'))
}
</script>

<template>
  <div style="padding: 16px; max-width: 600px">
    <h2 style="margin-top: 0">{{ store.t('settingsTitle') }}</h2>
    <label>{{ store.t('theme') }}</label>
    <NSpace align="center" style="margin-bottom: 16px">
      <NIcon size="24"><SunnyOutline /></NIcon>
      <NSwitch :value="store.isDark" @update:value="handleToggle" />
      <NIcon size="24"><MoonOutline /></NIcon>
      <span>{{ store.isDark ? store.t('darkMode') : store.t('lightMode') }}</span>
    </NSpace>
    <NSpace vertical>
      <label>{{ store.t('language') }}</label>
      <NSelect v-model:value="store.language" :options="languageOptions" style="max-width: 240px" />
    </NSpace>
  </div>
</template>
