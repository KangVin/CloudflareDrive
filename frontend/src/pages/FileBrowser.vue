<script setup lang="ts">
import { ref, onMounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NDataTable,
  NBreadcrumb,
  NIcon,
  NModal,
  NInput,
  NSpace,
  NEmpty,
  NSpin,
  NPopconfirm,
  NUpload,
  useMessage,
  type UploadCustomRequestOptions,
} from 'naive-ui'
import { FolderOpenOutline, DocumentOutline, CreateOutline, TrashOutline, CloudUploadOutline } from '@vicons/ionicons5'
import { useFileStore } from '@/stores/fileStore'
import type { FileRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const store = useFileStore()
const message = useMessage()

const loading = ref(false)
const showCreateModal = ref(false)
const newFolderName = ref('')
const renameTarget = ref<FileRecord | null>(null)
const showRenameModal = ref(false)
const renameName = ref('')

async function init() {
  loading.value = true
  try {
    const folderId = route.params.id as string | undefined
    await store.loadFolder(folderId ?? null)
  } finally {
    loading.value = false
  }
}

onMounted(init)
watch(() => route.params.id, init)

function navigateToFolder(id: string) {
  router.push(`/folder/${id}`)
}

function navigateToBreadcrumb(id: string | null) {
  if (id === null) {
    router.push('/')
  } else {
    router.push(`/folder/${id}`)
  }
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim()) return
  await store.createFolder(newFolderName.value.trim())
  newFolderName.value = ''
  showCreateModal.value = false
  message.success('Folder created')
}

function openRename(file: FileRecord) {
  renameTarget.value = file
  renameName.value = file.name
  showRenameModal.value = true
}

async function handleRename() {
  if (!renameTarget.value || !renameName.value.trim()) return
  await store.renameFile(renameTarget.value.id, renameName.value.trim())
  showRenameModal.value = false
  renameTarget.value = null
  message.success('Renamed')
}

async function handleDelete(file: FileRecord) {
  await store.deleteFile(file.id)
  message.success('Moved to trash')
}

async function handleUpload(options: UploadCustomRequestOptions) {
  try {
    const form = new FormData()
    form.append('file', options.file.file as File)
    const parentId = store.currentFolderId
    const url = parentId ? `/api/v1/files/upload?parentId=${parentId}` : '/api/v1/files/upload'
    const res = await fetch(url, { method: 'POST', body: form })
    if (!res.ok) throw new Error('Upload failed')
    options.onFinish?.()
    message.success('Uploaded')
    await store.loadFolder(store.currentFolderId)
  } catch (e) {
    options.onError?.()
    message.error('Upload failed')
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

const columns: DataTableColumn<FileRecord>[] = [
  {
    title: 'Name',
    key: 'name',
    render(row) {
      return row.type === 'folder'
        ? h(
            'a',
            {
              style: 'cursor:pointer;display:flex;align-items:center;gap:6px',
              onClick: () => navigateToFolder(row.id),
            },
            [h(NIcon, null, () => h(FolderOpenOutline)), row.name],
          )
        : h('span', { style: 'display:flex;align-items:center;gap:6px' }, [
            h(NIcon, null, () => h(DocumentOutline)),
            row.name,
          ])
    },
  },
  {
    title: 'Size',
    key: 'size',
    width: 100,
    render(row) {
      return row.type === 'folder' ? '-' : formatSize(row.size)
    },
  },
  {
    title: 'Type',
    key: 'type',
    width: 80,
  },
  {
    title: 'Created',
    key: 'createdAt',
    width: 180,
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 120,
    render(row) {
      return h(NSpace, null, [
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => openRename(row) }, () =>
          h(NIcon, null, () => h(CreateOutline)),
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => 'Move to trash?',
            trigger: () => h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
          },
        ),
      ])
    },
  },
]
</script>

<template>
  <div style="padding: 16px">
    <NSpace vertical size="large">
      <NSpace align="center" justify="space-between">
        <NBreadcrumb>
          <NBreadcrumbItem v-for="crumb in store.currentBreadcrumbs" :key="crumb.id ?? 'root'">
            <a v-if="crumb.id !== store.currentFolderId" href="#" @click.prevent="navigateToBreadcrumb(crumb.id)">
              {{ crumb.name }}
            </a>
            <span v-else>{{ crumb.name }}</span>
          </NBreadcrumbItem>
        </NBreadcrumb>
        <NSpace>
          <NUpload :custom-request="handleUpload" :show-file-list="false" accept="*">
            <NButton>
              <template #icon
                ><NIcon><CloudUploadOutline /></NIcon
              ></template>
              Upload
            </NButton>
          </NUpload>
          <NButton @click="showCreateModal = true">
            <template #icon
              ><NIcon><CreateOutline /></NIcon
            ></template>
            New Folder
          </NButton>
        </NSpace>
      </NSpace>

      <NSpin :show="loading">
        <NDataTable
          v-if="store.currentFiles.length > 0"
          :columns="columns"
          :data="store.currentFiles"
          :bordered="false"
          :single-line="false"
        />
        <NEmpty v-else description="No files yet" />
      </NSpin>
    </NSpace>

    <NModal v-model:show="showCreateModal" title="New Folder" preset="card" style="width: 360px">
      <NInput v-model:value="newFolderName" placeholder="Folder name" @keyup.enter="handleCreateFolder" />
      <template #footer>
        <NButton type="primary" @click="handleCreateFolder">Create</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showRenameModal" title="Rename" preset="card" style="width: 360px">
      <NInput v-model:value="renameName" placeholder="New name" @keyup.enter="handleRename" />
      <template #footer>
        <NButton type="primary" @click="handleRename">Rename</NButton>
      </template>
    </NModal>
  </div>
</template>
