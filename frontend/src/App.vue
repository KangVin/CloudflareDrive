<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <NConfigProvider :locale="settings.locale" :theme="settings.theme">
    <NMessageProvider>
      <AppLayout />
    </NMessageProvider>
  </NConfigProvider>
</template>
