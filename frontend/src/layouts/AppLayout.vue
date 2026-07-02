<script setup lang="ts">
import { computed, h } from 'vue'
import { NLayout, NLayoutHeader, NLayoutContent, NMenu, NIcon } from 'naive-ui'
import { useRouter } from 'vue-router'
import type { MenuOption } from 'naive-ui'
import { FolderOpenOutline, TrashOutline, ShareOutline, SettingsOutline } from '@vicons/ionicons5'
import { HEADER_HEIGHT } from '@/utils/constants'
import { useSettingsStore } from '@/stores/settingsStore'

const router = useRouter()
const settings = useSettingsStore()

const menuOptions = computed<MenuOption[]>(() => [
  {
    label: settings.t('files'),
    key: '/',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(FolderOpenOutline) }),
  },
  {
    label: settings.t('trash'),
    key: '/trash',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(TrashOutline) }),
  },
  {
    label: settings.t('shares'),
    key: '/shares',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(ShareOutline) }),
  },
  {
    label: settings.t('settings'),
    key: '/settings',
    icon: () => h(NIcon, { size: 18 }, { default: () => h(SettingsOutline) }),
  },
])

function handleMenuUpdate(key: string) {
  router.push(key)
}
</script>

<template>
  <NLayout style="height: 100vh">
    <NLayoutHeader bordered>
      <NMenu
        :value="router.currentRoute.value.path"
        :options="menuOptions"
        mode="horizontal"
        responsive
        @update:value="handleMenuUpdate"
      />
    </NLayoutHeader>
    <NLayoutContent :style="{ height: `calc(100vh - ${HEADER_HEIGHT}px)`, overflowY: 'auto' }">
      <div class="layout-content">
        <router-view />
      </div>
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.layout-content {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .layout-content {
    padding: 0 4px;
  }
}
</style>
