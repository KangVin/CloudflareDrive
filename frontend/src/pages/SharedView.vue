<script setup lang="ts">
import { ref, shallowRef, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSpin, NButton, NEmpty, NIcon, NInput, NPagination, useMessage } from 'naive-ui'
import {
  LockClosedOutline,
  DocumentOutline,
  DownloadOutline,
  FolderOpenOutline,
  ArrowBackOutline,
} from '@vicons/ionicons5'
import { getPublicShare, getPublicBrowse, verifySharePassword } from '@/api/shares'
import { useSettingsStore } from '@/stores/settingsStore'
import type { PublicShareResult, PublicShareFolder, PublicShareFileItem } from '@/types'

const DEFAULT_PAGE_SIZE = 50

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const message = useMessage()
const loading = ref(true)
const verifying = ref(false)
const error = ref<string | null>(null)
const data = shallowRef<PublicShareResult | null>(null)
const page = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)

/** Password-protected share state */
const passwordRequired = ref(false)
const passwordInput = ref('')
const verifyToken = ref<string | null>(null)

/** Stack of previous folder views for back navigation: each entry contains the folder data to restore */
const folderStack = shallowRef<
  Array<{ id: string; name: string; files: PublicShareFileItem[]; page: number; pageSize: number; total: number }>
>([])

/** Currently displayed folder data (for folder-type shares) */
const currentFolder = shallowRef<PublicShareFolder | null>(null)

/** Append verify token as query param for download links */
function dlUrl(path: string): string {
  return verifyToken.value
    ? `${path}${path.includes('?') ? '&' : '?'}vt=${encodeURIComponent(verifyToken.value)}`
    : path
}

const totalPages = computed(() => {
  if (!currentFolder.value) return 1
  return Math.max(1, Math.ceil(currentFolder.value.total / currentFolder.value.pageSize))
})

async function loadRoot() {
  loading.value = true
  error.value = null
  const token = route.params.token as string
  try {
    const result = await getPublicShare(token, page.value, pageSize.value, verifyToken.value ?? undefined)
    data.value = result
    if (result.type === 'folder') {
      currentFolder.value = result
      folderStack.value = []
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'password_required') {
      passwordRequired.value = true
    } else {
      error.value = settings.t('shareNotFoundOrExpired')
    }
  } finally {
    loading.value = false
  }
}

async function handleVerifyPassword() {
  if (!passwordInput.value) return
  verifying.value = true
  const token = route.params.token as string
  try {
    const res = await verifySharePassword(token, passwordInput.value)
    verifyToken.value = res.verify_token
    passwordRequired.value = false
    passwordInput.value = ''
    await loadRoot()
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'wrong_password') {
      message.error(settings.t('wrongPassword'))
    } else {
      message.error(settings.t('verificationFailed'))
    }
  } finally {
    verifying.value = false
  }
}

async function openFolder(folderId: string, _folderName: string) {
  loading.value = true
  const token = route.params.token as string
  try {
    const result = await getPublicBrowse(token, folderId, 1, DEFAULT_PAGE_SIZE, verifyToken.value ?? undefined)
    const cur = currentFolder.value
    if (cur) {
      folderStack.value = [
        ...folderStack.value,
        { id: cur.id, name: cur.name, files: cur.files, page: cur.page, pageSize: cur.pageSize, total: cur.total },
      ]
    }
    page.value = 1
    currentFolder.value = result
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'password_required') {
      verifyToken.value = null
      passwordRequired.value = true
      data.value = null
      currentFolder.value = null
      folderStack.value = []
      message.warning(settings.t('passwordExpired'))
    } else {
      message.error(msg || settings.t('failedToLoadFolders'))
    }
  } finally {
    loading.value = false
  }
}

function goBack() {
  const prev = folderStack.value.pop()
  if (prev) {
    currentFolder.value = {
      type: 'folder',
      id: prev.id,
      name: prev.name,
      files: prev.files,
      total: prev.total,
      page: prev.page,
      pageSize: prev.pageSize,
    }
    page.value = prev.page
    pageSize.value = prev.pageSize
    folderStack.value = [...folderStack.value]
  }
}

async function onPageChange(newPage: number) {
  page.value = newPage
  loading.value = true
  const token = route.params.token as string
  try {
    const cur = currentFolder.value
    if (!cur) return
    const isRoot = folderStack.value.length === 0
    const result = isRoot
      ? await getPublicShare(token, newPage, pageSize.value, verifyToken.value ?? undefined)
      : await getPublicBrowse(token, cur.id, newPage, pageSize.value, verifyToken.value ?? undefined)
    if (result.type === 'folder') currentFolder.value = result
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'password_required') {
      verifyToken.value = null
      passwordRequired.value = true
      data.value = null
      currentFolder.value = null
      folderStack.value = []
      message.warning(settings.t('passwordExpired'))
    } else {
      message.error(msg || settings.t('failedToLoadFolders'))
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadRoot)
</script>

<template>
  <div style="max-width: 720px; margin: 40px auto; padding: 0 16px">
    <div v-if="passwordRequired" style="text-align: center; margin-top: 80px">
      <NIcon size="48" style="color: #888; margin-bottom: 16px"><LockClosedOutline /></NIcon>
      <h3>{{ settings.t('shareEncrypted') }}</h3>
      <div style="max-width: 300px; margin: 16px auto">
        <NInput
          v-model:value="passwordInput"
          type="password"
          show-password-on="click"
          :placeholder="settings.t('passwordPlaceholder')"
          :disabled="verifying"
          @keyup.enter="handleVerifyPassword"
        />
      </div>
      <NButton type="primary" :loading="verifying" :disabled="!passwordInput" @click="handleVerifyPassword">
        {{ settings.t('verifyPassword') }}
      </NButton>
    </div>
    <NSpin v-else :show="loading">
      <div v-if="data">
        <template v-if="data.type === 'file'">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px">
            <NIcon size="48"><DocumentOutline /></NIcon>
            <div>
              <h2 style="margin: 0 0 4px">{{ data.name }}</h2>
              <span style="color: #888">{{ data.sizeFormatted }} · {{ data.mimeType }}</span>
            </div>
          </div>
          <NButton type="primary" :href="dlUrl(data.downloadUrl)" tag="a" target="_blank">
            <template #icon
              ><NIcon><DownloadOutline /></NIcon
            ></template>
            {{ settings.t('download') }}
          </NButton>
        </template>
        <template v-else-if="currentFolder">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
            <NButton v-if="folderStack.length > 0" quaternary size="small" @click="goBack">
              <template #icon
                ><NIcon><ArrowBackOutline /></NIcon
              ></template>
            </NButton>
            <h2 style="margin: 0; display: flex; align-items: center; gap: 8px">
              <NIcon><FolderOpenOutline /></NIcon>
              {{ currentFolder.name }}
            </h2>
          </div>
          <div
            v-for="file in currentFolder.files"
            :key="file.id"
            style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eee"
          >
            <NIcon>
              <FolderOpenOutline v-if="file.type === 'folder'" style="color: #f0ad4e" />
              <DocumentOutline v-else />
            </NIcon>
            <span
              :style="{ flex: 1, cursor: file.type === 'folder' ? 'pointer' : 'default', userSelect: 'none' }"
              @click="file.type === 'folder' && openFolder(file.id, file.name)"
            >
              {{ file.name }}
            </span>
            <span style="color: #888">{{ file.sizeFormatted }}</span>
            <NButton
              v-if="file.type === 'file'"
              size="tiny"
              :href="dlUrl(`/api/v1/s/${route.params.token}/download/${file.id}`)"
              tag="a"
              target="_blank"
            >
              <template #icon
                ><NIcon><DownloadOutline /></NIcon
              ></template>
              {{ settings.t('download') }}
            </NButton>
          </div>
          <div v-if="totalPages > 1" style="display: flex; justify-content: center; margin-top: 16px">
            <NPagination
              :page="currentFolder.page"
              :page-size="currentFolder.pageSize"
              :page-count="totalPages"
              @update:page="onPageChange"
            />
          </div>
        </template>
      </div>
      <NEmpty v-else-if="!loading" :description="error ?? settings.t('noContent')">
        <template #extra>
          <NButton @click="router.push('/')">{{ settings.t('goHome') }}</NButton>
        </template>
      </NEmpty>
    </NSpin>
  </div>
</template>
