import { createRouter, createWebHistory } from 'vue-router'
import FileBrowser from '@/pages/FileBrowser.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: FileBrowser,
    },
    {
      path: '/folder/:id',
      name: 'folder',
      component: FileBrowser,
    },
    {
      path: '/trash',
      name: 'trash',
      component: () => import('@/pages/Trash.vue'),
    },
    {
      path: '/shares',
      name: 'shares',
      component: () => import('@/pages/Shares.vue'),
    },
    {
      path: '/s/:token',
      name: 'shared-view',
      component: () => import('@/pages/SharedView.vue'),
    },
  ],
})

export default router
