<script setup lang="ts">
import { NConfigProvider, zhCN, darkTheme } from 'naive-ui'
import AppLayout from '@/layouts/AppLayout.vue'
</script>

<template>
  <NConfigProvider :locale="zhCN" :theme="darkTheme">
    <AppLayout />
  </NConfigProvider>
</template>
