<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NDataTable,
  NBreadcrumb,
  NBreadcrumbItem,
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
  NDropdown,
  useMessage,
  type UploadCustomRequestOptions,
  type DropdownOption,
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
import { useSettingsStore } from '@/stores/settingsStore'
import { searchFiles } from '@/api/search'
import { copyFile, listFiles, trashFile, updateFile } from '@/api/files'
import { createShare } from '@/api/shares'
import { formatSize } from '@/utils/format'
import { IMAGE_TYPES, TEXT_TYPES } from '@/utils/constants'
import { useUpload } from '@/composables/useUpload'
import UploadQueue from '@/components/UploadQueue.vue'
import type { FileRecord } from '@/types'
import type { DataTableColumn } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const store = useFileStore()
const settings = useSettingsStore()
const message = useMessage()

const DEFAULT_PAGE_SIZE = 50
const tablePagination = { pageSize: DEFAULT_PAGE_SIZE }

const loading = ref(false)
const showCreateModal = ref(false)
const newFolderName = ref('')
const renameTarget = ref<FileRecord | null>(null)
const showRenameModal = ref(false)
const renameName = ref('')

const checkedRowKeys = ref<string[]>([])
const { uploadTasks, createTask, updateTask, uploadFile, uploadFiles, clearFinished } = useUpload()
const selectedFiles = computed(() => displayedFiles.value.filter((file) => checkedRowKeys.value.includes(file.id)))
const clipboardItems = ref<FileRecord[]>([])
const clipboardMode = ref<'copy' | 'cut' | null>(null)
const contextMenuRow = ref<FileRecord | null>(null)
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function handleContextMenu(e: MouseEvent, row: FileRecord) {
  e.preventDefault()
  contextMenuRow.value = row
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  showContextMenu.value = true
}

function handleContextMenuSelect(key: string) {
  const file = contextMenuRow.value
  if (!file) return
  showContextMenu.value = false
  if (key === 'open') {
    if (file.type === 'folder') navigateToFolder(file.id)
  } else if (key === 'rename') {
    openRename(file)
  } else if (key === 'move') {
    openMoveModal(file)
  } else if (key === 'share') {
    openShareModal(file)
  } else if (key === 'copy') {
    checkedRowKeys.value = [file.id]
    copyFilesToClipboard([file])
  } else if (key === 'cut') {
    checkedRowKeys.value = [file.id]
    cutFilesToClipboard([file])
  } else if (key === 'paste') {
    pasteClipboardItems()
  } else if (key === 'delete') {
    handleDelete(file)
  } else if (key === 'preview' && file.type === 'file') {
    openPreview(file)
  }
}

const contextMenuOptions = computed<DropdownOption[]>(() => {
  const isFolder = contextMenuRow.value?.type === 'folder'
  return [
    ...(isFolder ? [{ label: settings.t('open'), key: 'open' }] : []),
    { label: settings.t('preview'), key: 'preview' },
    { type: 'divider' },
    { label: settings.t('rename'), key: 'rename' },
    { label: settings.t('move'), key: 'move' },
    { label: settings.t('share'), key: 'share' },
    { type: 'divider' },
    { label: settings.t('copy'), key: 'copy' },
    { label: settings.t('cut'), key: 'cut' },
    { label: settings.t('pasteHere'), key: 'paste' },
    { type: 'divider' },
    { label: settings.t('delete'), key: 'delete' },
  ]
})

function handleKeydown(e: KeyboardEvent) {
  if (
    showCreateModal.value ||
    showRenameModal.value ||
    showMoveModal.value ||
    showShareModal.value ||
    showPreviewModal.value
  )
    return
  if (e.ctrlKey && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    checkedRowKeys.value = displayedFiles.value.map((file) => file.id)
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    copySelectedToClipboard()
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'x') {
    e.preventDefault()
    cutSelectedToClipboard()
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'v') {
    e.preventDefault()
    pasteClipboardItems()
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && checkedRowKeys.value.length > 1) {
    if (!isSearchActive.value) handleBatchDelete()
    return
  }
  if (checkedRowKeys.value.length !== 1) return
  const file = displayedFiles.value.find((f) => f.id === checkedRowKeys.value[0])
  if (!file) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!isSearchActive.value) handleDelete(file)
  } else if (e.key === 'F2') {
    e.preventDefault()
    openRename(file)
  } else if (e.key === 'Enter') {
    if (file.type === 'folder') navigateToFolder(file.id)
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  init()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

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
  const dtFiles = e.dataTransfer?.files
  if (!dtFiles || dtFiles.length === 0) return
  const files = Array.from(dtFiles)
  let completedCount = 0
  await uploadFiles(files, store.currentFolderId, (_file, success) => {
    if (success) completedCount++
  })
  if (completedCount > 0) message.success(settings.t('uploaded'))
  await store.loadFolder(store.currentFolderId)
}

const moveTargets = ref<FileRecord[]>([])
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
    message.error(settings.t('failedToLoadPreview'))
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
    message.success(settings.t('shareLinkCreated'))
    showShareModal.value = false
    shareTarget.value = null
  } catch {
    message.error(settings.t('failedToCreateShareLink'))
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
    message.error(settings.t('searchFailed'))
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
    message.success(settings.t('create'))
  } catch {
    message.error(settings.t('failedToCreateFolder'))
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
    message.success(settings.t('renamed'))
  } catch {
    message.error(settings.t('failedToRename'))
  }
}

async function handleDelete(file: FileRecord) {
  try {
    await store.deleteFile(file.id)
    checkedRowKeys.value = checkedRowKeys.value.filter((id) => id !== file.id)
    message.success(settings.t('movedToTrash'))
  } catch {
    message.error(settings.t('failedToDelete'))
  }
}

async function handleBatchDelete() {
  if (selectedFiles.value.length === 0) return
  try {
    for (const file of selectedFiles.value) {
      await trashFile(file.id)
    }
    checkedRowKeys.value = []
    message.success(settings.t('movedSelectedToTrash'))
    await init()
  } catch {
    message.error(settings.t('failedToDeleteSelectedFiles'))
  }
}

function copySelectedToClipboard() {
  if (selectedFiles.value.length === 0) return
  copyFilesToClipboard(selectedFiles.value)
}

function cutSelectedToClipboard() {
  if (selectedFiles.value.length === 0) return
  cutFilesToClipboard(selectedFiles.value)
}

function copyFilesToClipboard(files: FileRecord[]) {
  clipboardItems.value = [...files]
  clipboardMode.value = 'copy'
  message.success(settings.t('copiedToClipboard'))
}

function cutFilesToClipboard(files: FileRecord[]) {
  clipboardItems.value = [...files]
  clipboardMode.value = 'cut'
  message.success(settings.t('cutToClipboard'))
}

async function pasteClipboardItems() {
  if (!clipboardMode.value || clipboardItems.value.length === 0 || isSearchActive.value) return
  try {
    for (const file of clipboardItems.value) {
      if (clipboardMode.value === 'copy') {
        await copyFile(file.id, store.currentFolderId)
      } else {
        await updateFile(file.id, { parentId: store.currentFolderId })
      }
    }
    if (clipboardMode.value === 'cut') {
      clipboardItems.value = []
      clipboardMode.value = null
    }
    checkedRowKeys.value = []
    message.success(settings.t('pasted'))
    await init()
  } catch (e) {
    message.error(e instanceof Error ? e.message : settings.t('failedToPaste'))
  }
}

function openMoveModal(file: FileRecord) {
  moveTargets.value = [file]
  moveCurrentFolderId.value = null
  moveBreadcrumbs.value = [{ id: null, name: settings.t('root') }]
  loadMoveFolders(null)
  showMoveModal.value = true
}

function openBatchMoveModal() {
  if (selectedFiles.value.length === 0) return
  moveTargets.value = [...selectedFiles.value]
  moveCurrentFolderId.value = null
  moveBreadcrumbs.value = [{ id: null, name: settings.t('root') }]
  loadMoveFolders(null)
  showMoveModal.value = true
}

async function loadMoveFolders(parentId: string | null) {
  moveLoadingFolders.value = true
  try {
    const all = await listFiles(parentId ?? undefined)
    moveFolderItems.value = all.filter((f) => f.type === 'folder')
  } catch {
    message.error(settings.t('failedToLoadFolders'))
  } finally {
    moveLoadingFolders.value = false
  }
}

function navigateMoveFolder(id: string | null) {
  if (id === null) {
    moveBreadcrumbs.value = [{ id: null, name: settings.t('root') }]
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
  if (moveTargets.value.length === 0) return
  try {
    for (const file of moveTargets.value) {
      await updateFile(file.id, { parentId: moveCurrentFolderId.value })
    }
    message.success(settings.t('movedSuccessfully'))
    showMoveModal.value = false
    moveTargets.value = []
    checkedRowKeys.value = []
    await init()
  } catch (e) {
    message.error(e instanceof Error ? e.message : settings.t('failedToMove'))
  }
}

function handleUpload(options: UploadCustomRequestOptions) {
  const file = options.file.file as File
  const task = createTask(file)
  uploadFile(file, store.currentFolderId, task.id, (percent) => {
    updateTask(task.id, { percent })
    options.onProgress?.({ percent })
  })
    .then(async () => {
      updateTask(task.id, { percent: 100, status: 'success' })
      options.onFinish?.()
      message.success(settings.t('uploaded'))
      await store.loadFolder(store.currentFolderId)
    })
    .catch(() => {
      updateTask(task.id, { status: 'error' })
      options.onError?.()
      message.error(settings.t('failedToUpload'))
    })
}

const columns = computed<DataTableColumn<FileRecord>[]>(() => [
  {
    type: 'selection',
  },
  {
    title: settings.t('name'),
    key: 'name',
    sorter: true,
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
    title: settings.t('size'),
    key: 'size',
    width: 100,
    sorter: (a, b) => a.size - b.size,
    render(row) {
      return row.type === 'folder' ? '-' : formatSize(row.size)
    },
  },
  {
    title: settings.t('type'),
    key: 'type',
    width: 80,
    sorter: true,
  },
  {
    title: settings.t('created'),
    key: 'createdAt',
    width: 180,
    sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
    render(row) {
      return new Date(row.createdAt).toLocaleString()
    },
  },
  {
    title: settings.t('actions'),
    key: 'actions',
    width: 220,
    render(row) {
      return h(NSpace, null, [
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openRename(row) }, () =>
              h(NIcon, null, () => h(CreateOutline)),
            ),
          default: () => settings.t('rename'),
        }),
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openMoveModal(row) }, () =>
              h(NIcon, null, () => h(MoveOutline)),
            ),
          default: () => settings.t('move'),
        }),
        row.type === 'file'
          ? h(NTooltip, null, {
              trigger: () =>
                h(NButton, { size: 'tiny', quaternary: true, onClick: () => openPreview(row) }, () =>
                  h(NIcon, null, () => h(EyeOutline)),
                ),
              default: () => settings.t('preview'),
            })
          : null,
        h(NTooltip, null, {
          trigger: () =>
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openShareModal(row) }, () =>
              h(NIcon, null, () => h(ShareOutline)),
            ),
          default: () => settings.t('share'),
        }),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => settings.t('moveToTrashConfirm'),
            trigger: () =>
              h(NTooltip, null, {
                trigger: () =>
                  h(NButton, { size: 'tiny', quaternary: true }, () => h(NIcon, null, () => h(TrashOutline))),
                default: () => settings.t('delete'),
              }),
          },
        ),
      ])
    },
  },
])
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
      {{ settings.t('dropFilesToUpload') }}
    </div>
    <NSpace vertical size="large">
      <NSpace align="center" justify="space-between">
        <NBreadcrumb v-if="!isSearchActive" separator="›">
          <NBreadcrumbItem v-for="crumb in store.currentBreadcrumbs" :key="crumb.id ?? 'root'">
            <a v-if="crumb.id !== store.currentFolderId" href="#" @click.prevent="navigateToBreadcrumb(crumb.id)">
              {{ crumb.id === null ? settings.t('root') : crumb.name }}
            </a>
            <span v-else>{{ crumb.id === null ? settings.t('root') : crumb.name }}</span>
          </NBreadcrumbItem>
        </NBreadcrumb>
        <span v-else style="font-weight: 600">{{ settings.t('searchResults') }}</span>
        <NSpace>
          <NInput
            v-model:value="searchQuery"
            :placeholder="settings.t('searchFiles')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="clearSearch"
          >
            <template #prefix>
              <NIcon><SearchOutline /></NIcon>
            </template>
            <template v-if="isSearchActive" #suffix>
              <NIcon style="cursor: pointer" @click="clearSearch"><CloseOutline /></NIcon>
            </template>
          </NInput>
          <NUpload v-if="!isSearchActive" :custom-request="handleUpload" :show-file-list="false" accept="*" multiple>
            <NButton>
              <template #icon
                ><NIcon><CloudUploadOutline /></NIcon
              ></template>
              {{ settings.t('upload') }}
            </NButton>
          </NUpload>
          <NButton v-if="!isSearchActive" @click="showCreateModal = true">
            <template #icon
              ><NIcon><CreateOutline /></NIcon
            ></template>
            {{ settings.t('newFolder') }}
          </NButton>
        </NSpace>
      </NSpace>

      <NSpace v-if="checkedRowKeys.length > 0" align="center">
        <span>{{ checkedRowKeys.length }} {{ settings.t('selected') }}</span>
        <NButton size="small" @click="copySelectedToClipboard">{{ settings.t('copy') }}</NButton>
        <NButton size="small" @click="cutSelectedToClipboard">{{ settings.t('cut') }}</NButton>
        <NButton size="small" @click="openBatchMoveModal">{{ settings.t('move') }}</NButton>
        <NPopconfirm @positive-click="handleBatchDelete">
          <template #trigger>
            <NButton size="small" type="error">{{ settings.t('delete') }}</NButton>
          </template>
          {{ settings.t('moveSelectedToTrashConfirm') }}
        </NPopconfirm>
      </NSpace>

      <NSpace v-if="clipboardMode" align="center">
        <span
          >{{ clipboardItems.length }}
          {{ clipboardMode === 'copy' ? settings.t('itemCopied') : settings.t('itemCut') }}</span
        >
        <NButton size="small" :disabled="isSearchActive" @click="pasteClipboardItems">{{
          settings.t('pasteHere')
        }}</NButton>
      </NSpace>

      <UploadQueue :tasks="uploadTasks" @clear-finished="clearFinished" />

      <NSpin :show="loading || isSearching">
        <div v-if="displayedFiles.length > 0" class="file-table">
          <NDataTable
            v-model:checked-row-keys="checkedRowKeys"
            :columns="columns"
            :data="displayedFiles"
            :bordered="false"
            :single-line="false"
            :row-key="(row: FileRecord) => row.id"
            :row-props="(row: FileRecord) => ({ onContextmenu: (e: MouseEvent) => handleContextMenu(e, row) })"
            :pagination="tablePagination"
          />
        </div>
        <NEmpty v-else :description="settings.t('noFilesYet')" />
      </NSpin>
      <NDropdown
        trigger="manual"
        placement="bottom-start"
        :show="showContextMenu"
        :x="contextMenuX"
        :y="contextMenuY"
        :options="contextMenuOptions"
        @select="handleContextMenuSelect"
        @clickoutside="showContextMenu = false"
      />
    </NSpace>

    <NModal v-model:show="showCreateModal" :title="settings.t('newFolder')" preset="card" style="width: 360px">
      <NInput v-model:value="newFolderName" :placeholder="settings.t('folderName')" @keyup.enter="handleCreateFolder" />
      <template #footer>
        <NButton type="primary" @click="handleCreateFolder">{{ settings.t('create') }}</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showRenameModal" :title="settings.t('rename')" preset="card" style="width: 360px">
      <NInput v-model:value="renameName" :placeholder="settings.t('name')" @keyup.enter="handleRename" />
      <template #footer>
        <NButton type="primary" @click="handleRename">{{ settings.t('rename') }}</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showMoveModal" :title="settings.t('moveTo')" preset="card" style="width: 420px">
      <NSpace vertical>
        <NBreadcrumb separator="›">
          <NBreadcrumbItem v-for="crumb in moveBreadcrumbs" :key="crumb.id ?? 'root'">
            <a v-if="crumb.id !== moveCurrentFolderId" href="#" @click.prevent="navigateMoveFolder(crumb.id)">
              {{ crumb.id === null ? settings.t('root') : crumb.name }}
            </a>
            <span v-else>{{ crumb.id === null ? settings.t('root') : crumb.name }}</span>
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
          <NEmpty v-else :description="settings.t('noSubfolders')" />
        </NSpin>
      </NSpace>
      <template #footer>
        <NButton type="primary" :disabled="moveLoadingFolders" @click="handleMove">{{
          settings.t('moveHere')
        }}</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showShareModal" :title="settings.t('createShareLink')" preset="card" style="width: 400px">
      <p v-if="shareTarget" style="margin-top: 0">
        {{ settings.t('shareVerb') }} <strong>{{ shareTarget.name }}</strong> {{ settings.t('sharePublicLink') }}
      </p>
      <NSpace vertical>
        <label>{{ settings.t('expiry') }}</label>
        <NSelect
          v-model:value="shareExpiryDays"
          :options="[
            { label: `1 ${settings.t('day')}`, value: 1 },
            { label: `7 ${settings.t('days')}`, value: 7 },
            { label: `30 ${settings.t('days')}`, value: 30 },
            { label: settings.t('never'), value: 0 },
          ]"
          :placeholder="settings.t('expiry')"
        />
      </NSpace>
      <template #footer>
        <NButton type="primary" :disabled="sharingLoading" @click="handleCreateShare">{{
          settings.t('createLink')
        }}</NButton>
      </template>
    </NModal>

    <NModal
      v-model:show="showPreviewModal"
      :title="previewTarget?.name ?? settings.t('preview')"
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
        <NEmpty v-else-if="!previewLoading" :description="settings.t('previewNotAvailable')" />
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .file-table {
    overflow-x: auto;
  }
}
</style>
