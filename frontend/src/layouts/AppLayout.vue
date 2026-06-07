<script setup lang="ts">
import { h } from 'vue'
import { NLayout, NLayoutHeader, NLayoutContent, NMenu } from 'naive-ui'
import { useRouter } from 'vue-router'
import type { MenuOption } from 'naive-ui'
import { FolderOpenOutline, TrashOutline, ShareOutline } from '@vicons/ionicons5'

const router = useRouter()

const menuOptions: MenuOption[] = [
  {
    label: 'Files',
    key: '/',
    icon: () => h(FolderOpenOutline),
  },
  {
    label: 'Trash',
    key: '/trash',
    icon: () => h(TrashOutline),
  },
  {
    label: 'Shares',
    key: '/shares',
    icon: () => h(ShareOutline),
  },
]

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
        @update:value="handleMenuUpdate"
      />
    </NLayoutHeader>
    <NLayoutContent style="height: calc(100vh - 64px); overflow-y: auto">
      <router-view />
    </NLayoutContent>
  </NLayout>
</template>
