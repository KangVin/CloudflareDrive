import { ref, computed } from 'vue'

/** Upload item status displayed in the upload queue */
export type UploadTaskStatus = 'uploading' | 'success' | 'error'

/** Upload task displayed in the upload progress panel */
export interface UploadTask {
  id: string
  name: string
  percent: number
  status: UploadTaskStatus
}

const UPLOAD_DONE_PERCENT = 100
const MAX_CONCURRENT_UPLOADS = 4

let globalInstance: ReturnType<typeof createUploadState> | null = null

function createUploadState() {
  const uploadTasks = ref<UploadTask[]>([])
  const hasUploadTasks = computed(() => uploadTasks.value.length > 0)

  function createTask(file: File): UploadTask {
    const task: UploadTask = {
      id: crypto.randomUUID(),
      name: file.name,
      percent: 0,
      status: 'uploading',
    }
    uploadTasks.value.unshift(task)
    return task
  }

  function updateTask(id: string, patch: Partial<Omit<UploadTask, 'id' | 'name'>>) {
    const task = uploadTasks.value.find((item) => item.id === id)
    if (task) Object.assign(task, patch)
  }

  function clearFinished() {
    uploadTasks.value = uploadTasks.value.filter((task) => task.status === 'uploading')
  }

  function getProgressStatus(task: UploadTask): 'default' | 'success' | 'error' {
    if (task.status === 'success') return 'success'
    if (task.status === 'error') return 'error'
    return 'default'
  }

  function uploadFile(file: File, parentId: string | null, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('file', file)
      const xhr = new XMLHttpRequest()
      const url = parentId ? `/api/v1/files/upload?parentId=${parentId}` : '/api/v1/files/upload'
      xhr.open('POST', url)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * UPLOAD_DONE_PERCENT))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(UPLOAD_DONE_PERCENT)
          resolve()
        } else {
          reject(new Error('Upload failed'))
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(form)
    })
  }

  async function uploadFiles(
    files: File[],
    parentId: string | null,
    onFileComplete?: (file: File, success: boolean) => void,
  ) {
    const queue = [...files]
    const workers: Promise<void>[] = []

    async function worker() {
      while (queue.length > 0) {
        const file = queue.shift()!
        const task = createTask(file)
        try {
          await uploadFile(file, parentId, (percent) => {
            updateTask(task.id, { percent })
          })
          updateTask(task.id, { percent: UPLOAD_DONE_PERCENT, status: 'success' })
          onFileComplete?.(file, true)
        } catch {
          updateTask(task.id, { status: 'error' })
          onFileComplete?.(file, false)
        }
      }
    }

    for (let i = 0; i < Math.min(MAX_CONCURRENT_UPLOADS, files.length); i++) {
      workers.push(worker())
    }
    await Promise.all(workers)
  }

  return {
    uploadTasks,
    hasUploadTasks,
    createTask,
    updateTask,
    clearFinished,
    getProgressStatus,
    uploadFile,
    uploadFiles,
  }
}

export function useUpload() {
  if (!globalInstance) {
    globalInstance = createUploadState()
  }
  return globalInstance
}
