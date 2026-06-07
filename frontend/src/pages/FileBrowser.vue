<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue'
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
  NSelect,
  NTooltip,
  useMessage,
  type UploadCustomRequestOptions,
} from 'naive-ui'
import {
  FolderOpenOutline,
  DocumentOutline,
  CreateOutline,
  TrashOutline,
  CloudUploadOutline,
  SearchOutline,
  CloseOutline,
  MoveOutline,
  EyeOutline,
  ShareOutline,
} from '@vicons/ionicons5'
import { useFileStore } from '@/stores/fileStore'
import { searchFiles } from '@/api/search'
import { listFiles, updateFile } from '@/api/files'
import { createShare } from '@/api/shares'
import { formatSize } from '@/utils/format'
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

const searchQuery = ref('')
const searchResults = ref<FileRecord[]>([])
const isSearching = ref(false)

const isDragging = ref(false)
let dragCounter = 0

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  if (e.dataTransfer?.types.includes('Files')) {
    isDragging.value = true
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragging.value = false
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  dragCounter = 0
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const parentId = store.currentFolderId
  const uploadUrl = parentId ? `/api/v1/files/upload?parentId=${parentId}` : '/api/v1/files/upload'
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(uploadUrl, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
    } catch {
      message.error(`Failed to upload: ${file.name}`)
    }
  }
  message.success('Uploaded')
  await store.loadFolder(store.currentFolderId)
}

const moveTarget = ref<FileRecord | null>(null)
const showMoveModal = ref(false)
const moveCurrentFolderId = ref<string | null>(null)
const moveFolderItems = ref<FileRecord[]>([])
const moveLoadingFolders = ref(false)
const moveBreadcrumbs = ref<{ id: string | null; name: string }[]>([])

const previewTarget = ref<FileRecord | null>(null)
const showPreviewModal = ref(false)
const previewContent = ref<string | null>(null)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']
const TEXT_TYPES = [
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'text/markdown',
  'text/x-markdown',
  'text/x-python',
  'text/x-java',
  'text/x-c',
  'text/x-c++',
  'text/x-typescript',
  'text/x-sh',
  'text/x-yaml',
  'text/x-toml',
]

async function openPreview(file: FileRecord) {
  previewTarget.value = file
  showPreviewModal.value = true
  previewContent.value = null
  previewUrl.value = null
  previewLoading.value = true
  try {
    const res = await fetch(`/api/v1/files/${file.id}/download`)
    if (!res.ok) throw new Error('Download failed')
    const mime = file.mimeType || ''
    if (IMAGE_TYPES.includes(mime)) {
      const blob = await res.blob()
      previewUrl.value = URL.createObjectURL(blob)
    } else if (TEXT_TYPES.includes(mime) || mime.startsWith('text/')) {
      previewContent.value = await res.text()
    } else {
      previewContent.value = null
    }
  } catch {
    message.error('Failed to load preview')
  } finally {
    previewLoading.value = false
  }
}

const shareTarget = ref<FileRecord | null>(null)
const showShareModal = ref(false)
const shareExpiryDays = ref<number>(0)
const sharingLoading = ref(false)

function openShareModal(file: FileRecord) {
  shareTarget.value = file
  shareExpiryDays.value = 0
  showShareModal.value = true
}

async function handleCreateShare() {
  if (!shareTarget.value) return
  sharingLoading.value = true
  try {
    let expiresAt: string | null = null
    if (shareExpiryDays.value > 0) {
      const d = new Date()
      d.setDate(d.getDate() + shareExpiryDays.value)
      expiresAt = d.toISOString()
    }
    await createShare(shareTarget.value.id, expiresAt)
    message.success('Share link created')
    showShareModal.value = false
    shareTarget.value = null
  } catch {
    message.error('Failed to create share link')
  } finally {
    sharingLoading.value = false
  }
}

function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  previewContent.value = null
  previewTarget.value = null
  showPreviewModal.value = false
}

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

async function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) {
    clearSearch()
    return
  }
  isSearching.value = true
  try {
    searchResults.value = await searchFiles(q)
  } catch {
    message.error('Search failed')
  } finally {
    isSearching.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  isSearching.value = false
}

const displayedFiles = computed(() =>
  isSearching.value || searchResults.value.length > 0 ? searchResults.value : store.currentFiles,
)
const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

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
  try {
    await store.createFolder(newFolderName.value.trim())
    newFolderName.value = ''
    showCreateModal.value = false
    message.success('Folder created')
  } catch {
    message.error('Failed to create folder')
  }
}

function openRename(file: FileRecord) {
  renameTarget.value = file
  renameName.value = file.name
  showRenameModal.value = true
}

async function handleRename() {
  if (!renameTarget.value || !renameName.value.trim()) return
  try {
    await store.renameFile(renameTarget.value.id, renameName.value.trim())
    showRenameModal.value = false
    renameTarget.value = null
    message.success('Renamed')
  } catch {
    message.error('Failed to rename')
  }
}

async function handleDelete(file: FileRecord) {
  try {
    await store.deleteFile(file.id)
    message.success('Moved to trash')
  } catch {
    message.error('Failed to delete')
  }
}

function openMoveModal(file: FileRecord) {
  moveTarget.value = file
  moveCurrentFolderId.value = null
  moveBreadcrumbs.value = [{ id: null, name: 'Root' }]
  loadMoveFolders(null)
  showMoveModal.value = true
}

async function loadMoveFolders(parentId: string | null) {
  moveLoadingFolders.value = true
  try {
    const all = await listFiles(parentId ?? undefined)
    moveFolderItems.value = all.filter((f) => f.type === 'folder')
  } catch {
    message.error('Failed to load folders')
  } finally {
    moveLoadingFolders.value = false
  }
}

function navigateMoveFolder(id: string | null) {
  if (id === null) {
    moveBreadcrumbs.value = [{ id: null, name: 'Root' }]
    moveCurrentFolderId.value = null
    loadMoveFolders(null)
    return
  }
  const existing = moveBreadcrumbs.value.findIndex((b) => b.id === id)
  if (existing !== -1) {
    moveBreadcrumbs.value = moveBreadcrumbs.value.slice(0, existing + 1)
  } else {
    const folder = moveFolderItems.value.find((f) => f.id === id)
    if (folder) moveBreadcrumbs.value.push({ id: folder.id, name: folder.name })
  }
  moveCurrentFolderId.value = id
  loadMoveFolders(id)
}

async function handleMove() {
  if (!moveTarget.value) return
  try {
    await updateFile(moveTarget.value.id, { parentId: moveCurrentFolderId.value })
    message.success('Moved successfully')
    showMoveModal.value = false
    moveTarget.value = null
    await init()
  } catch {
    message.error('Failed to move')
  }
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
  } catch {
    options.onError?.()
    message.error('Upload failed')
  }
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
    width: 220,
    render(row) {
      return h(NSpace, null, [
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openRename(row) }, () =>
              h(NIcon, null, () => h(CreateOutline)),
            ),
          default: () => 'Rename',
        }),
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openMoveModal(row) }, () =>
              h(NIcon, null, () => h(MoveOutline)),
            ),
          default: () => 'Move',
        }),
        row.type === 'file'
          ? h(NTooltip, null, {
              trigger: () =>
                h(NButton, { size: 'tiny', quaternary: true, onClick: () => openPreview(row) }, () =>
                  h(NIcon, null, () => h(EyeOutline)),
                ),
              default: () => 'Preview',
            })
          : null,
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openShareModal(row) }, () =>
              h(NIcon, null, () => h(ShareOutline)),
            ),
          default: () => 'Share',
        }),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => 'Move to trash?',
            trigger: () =>
              h(NTooltip, null, {
                trigger: () =>
                  h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
                default: () => 'Delete',
              }),
          },
        ),
      ])
    },
  },
]
</script>

<template>
  <div
    style="padding: 16px; position: relative; min-height: 300px"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div
      v-if="isDragging"
      style="
        position: absolute;
        inset: 0;
        z-index: 100;
        background: rgba(24, 160, 88, 0.08);
        border: 2px dashed #18a058;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #18a058;
      "
    >
      Drop files to upload
    </div>
    <NSpace vertical size="large">
      <NSpace align="center" justify="space-between">
        <NBreadcrumb v-if="!isSearchActive">
          <NBreadcrumbItem v-for="crumb in store.currentBreadcrumbs" :key="crumb.id ?? 'root'">
            <a v-if="crumb.id !== store.currentFolderId" href="#" @click.prevent="navigateToBreadcrumb(crumb.id)">
              {{ crumb.name }}
            </a>
            <span v-else>{{ crumb.name }}</span>
          </NBreadcrumbItem>
        </NBreadcrumb>
        <span v-else style="font-weight: 600">Search results</span>
        <NSpace>
          <NInput
            v-model:value="searchQuery"
            placeholder="Search files..."
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="clearSearch"
          >
            <template #prefix>
              <NIcon><SearchOutline /></NIcon>
            </template>
            <template #suffix v-if="isSearchActive">
              <NIcon style="cursor: pointer" @click="clearSearch"><CloseOutline /></NIcon>
            </template>
          </NInput>
          <NUpload v-if="!isSearchActive" :custom-request="handleUpload" :show-file-list="false" accept="*">
            <NButton>
              <template #icon
                ><NIcon><CloudUploadOutline /></NIcon
              ></template>
              Upload
            </NButton>
          </NUpload>
          <NButton v-if="!isSearchActive" @click="showCreateModal = true">
            <template #icon
              ><NIcon><CreateOutline /></NIcon
            ></template>
            New Folder
          </NButton>
        </NSpace>
      </NSpace>

      <NSpin :show="loading || isSearching">
        <NDataTable
          v-if="displayedFiles.length > 0"
          :columns="columns"
          :data="displayedFiles"
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

    <NModal v-model:show="showMoveModal" title="Move to..." preset="card" style="width: 420px">
      <NSpace vertical>
        <NBreadcrumb>
          <NBreadcrumbItem v-for="crumb in moveBreadcrumbs" :key="crumb.id ?? 'root'">
            <a v-if="crumb.id !== moveCurrentFolderId" href="#" @click.prevent="navigateMoveFolder(crumb.id)">
              {{ crumb.name }}
            </a>
            <span v-else>{{ crumb.name }}</span>
          </NBreadcrumbItem>
        </NBreadcrumb>
        <NSpin :show="moveLoadingFolders">
          <div v-if="moveFolderItems.length > 0" style="max-height: 300px; overflow-y: auto">
            <div
              v-for="folder in moveFolderItems"
              :key="folder.id"
              style="cursor: pointer; padding: 6px 8px; display: flex; align-items: center; gap: 6px"
              @click="navigateMoveFolder(folder.id)"
            >
              <NIcon><FolderOpenOutline /></NIcon>
              {{ folder.name }}
            </div>
          </div>
          <NEmpty v-else description="No subfolders" />
        </NSpin>
      </NSpace>
      <template #footer>
        <NButton type="primary" :disabled="moveLoadingFolders" @click="handleMove">Move here</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showShareModal" title="Create Share Link" preset="card" style="width: 400px">
      <p v-if="shareTarget" style="margin-top: 0">
        Share <strong>{{ shareTarget.name }}</strong> via a public link
      </p>
      <NSpace vertical>
        <label>Expiry</label>
        <NSelect
          v-model:value="shareExpiryDays"
          :options="[
            { label: '1 day', value: 1 },
            { label: '7 days', value: 7 },
            { label: '30 days', value: 30 },
            { label: 'Never', value: 0 },
          ]"
          placeholder="Select expiry..."
        />
      </NSpace>
      <template #footer>
        <NButton type="primary" :disabled="sharingLoading" @click="handleCreateShare">Create Link</NButton>
      </template>
    </NModal>

    <NModal
      v-model:show="showPreviewModal"
      :title="previewTarget?.name ?? 'Preview'"
      preset="card"
      style="width: 800px; max-height: 90vh"
      @update:show="
        (val: boolean) => {
          if (!val) closePreview()
        }
      "
    >
      <NSpin :show="previewLoading">
        <div v-if="previewUrl" style="text-align: center">
          <img :src="previewUrl" alt="Preview" style="max-width: 100%; max-height: 70vh; object-fit: contain" />
        </div>
        <pre
          v-else-if="previewContent !== null"
          style="max-height: 70vh; overflow: auto; white-space: pre-wrap; word-break: break-all; margin: 0"
          >{{ previewContent }}</pre
        >
        <NEmpty v-else-if="!previewLoading" description="Preview not available for this file type" />
      </NSpin>
    </NModal>
  </div>
</template>
