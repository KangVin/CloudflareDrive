<script setup lang="ts">
import { NConfigProvider, NMessageProvider, zhCN, darkTheme } from 'naive-ui'
import AppLayout from '@/layouts/AppLayout.vue'
</script>

<template>
  <NConfigProvider :locale="zhCN" :theme="darkTheme">
    <NMessageProvider>
      <AppLayout />
    </NMessageProvider>
  </NConfigProvider>
</template>
