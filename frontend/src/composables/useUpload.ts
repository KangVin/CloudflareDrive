import { ref, computed } from 'vue'

/** Upload item status displayed in the upload queue */
export type UploadTaskStatus = 'hashing' | 'uploading' | 'success' | 'error'

/** Upload task displayed in the upload progress panel */
export interface UploadTask {
  id: string
  name: string
  percent: number
  status: UploadTaskStatus
}

const UPLOAD_DONE_PERCENT = 100
const MAX_CONCURRENT_UPLOADS = 4
const CHUNK_THRESHOLD = 50 * 1024 * 1024
const CHUNK_SIZE = 5 * 1024 * 1024
const MAX_CHUNK_RETRIES = 3
const RETRY_BASE_DELAY = 1000

let globalInstance: ReturnType<typeof createUploadState> | null = null

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function checkHash(hash: string): Promise<boolean> {
  const res = await fetch(`/api/v1/files/by-hash?hash=${encodeURIComponent(hash)}`)
  if (res.status === 404) return false
  if (!res.ok) throw new Error('Failed to check hash')
  return true
}

async function instantUpload(hash: string, parentId: string | null, name: string, mimeType: string): Promise<void> {
  const res = await fetch('/api/v1/files/instant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash, parentId, name, mimeType }),
  })
  if (!res.ok) throw new Error('Instant upload failed')
}

function createUploadState() {
  const uploadTasks = ref<UploadTask[]>([])
  const hasUploadTasks = computed(() => uploadTasks.value.length > 0)

  function createTask(file: File): UploadTask {
    const task: UploadTask = {
      id: crypto.randomUUID(),
      name: file.name,
      percent: 0,
      status: 'hashing',
    }
    uploadTasks.value.unshift(task)
    return task
  }

  function updateTask(id: string, patch: Partial<Omit<UploadTask, 'id' | 'name'>>) {
    const task = uploadTasks.value.find((item) => item.id === id)
    if (task) Object.assign(task, patch)
  }

  function clearFinished() {
    uploadTasks.value = uploadTasks.value.filter((task) => task.status === 'hashing' || task.status === 'uploading')
  }

  function getProgressStatus(task: UploadTask): 'default' | 'success' | 'error' {
    if (task.status === 'success') return 'success'
    if (task.status === 'error') return 'error'
    return 'default'
  }

  async function uploadFile(
    file: File,
    parentId: string | null,
    taskId: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    if (file.size > CHUNK_THRESHOLD) {
      updateTask(taskId, { status: 'uploading', percent: 0 })
      await uploadFileChunked(file, parentId, taskId, onProgress)
      return
    }

    updateTask(taskId, { status: 'hashing', percent: 0 })
    const hash = await computeFileHash(file)

    if (await checkHash(hash)) {
      await instantUpload(hash, parentId, file.name, file.type)
      onProgress?.(UPLOAD_DONE_PERCENT)
      return
    }

    updateTask(taskId, { status: 'uploading', percent: 0 })
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('file', file)
      form.append('hash', hash)
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

  async function uploadFileChunked(
    file: File,
    parentId: string | null,
    taskId: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const chunkProgress = new Array<number>(totalChunks).fill(0)
    const concurrency = Math.min(MAX_CONCURRENT_UPLOADS, totalChunks)

    function emitProgress() {
      const sum = chunkProgress.reduce((a, b) => a + b, 0)
      onProgress?.(Math.round((sum / totalChunks) * UPLOAD_DONE_PERCENT))
    }

    const createRes = await fetch('/api/v1/files/upload/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name }),
    })
    if (!createRes.ok) throw new Error('Failed to create multipart upload')
    const { uploadId, key } = await createRes.json()

    const parts: { partNumber: number; etag: string }[] = []

    async function uploadSingleChunk(index: number, blob: Blob, attempt: number = 0): Promise<void> {
      try {
        const { etag } = await new Promise<{ etag: string }>((resolve, reject) => {
          const form = new FormData()
          form.append('uploadId', uploadId)
          form.append('key', key)
          form.append('partNumber', String(index + 1))
          form.append('chunk', blob)
          const xhr = new XMLHttpRequest()
          xhr.open('POST', '/api/v1/files/upload/part')
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              chunkProgress[index] = e.loaded / e.total
              emitProgress()
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText))
              } catch {
                reject(new Error('Invalid chunk upload response'))
              }
            } else {
              reject(new Error('Chunk upload failed'))
            }
          }
          xhr.onerror = () => reject(new Error('Chunk upload failed'))
          xhr.send(form)
        })
        chunkProgress[index] = 1
        emitProgress()
        parts.push({ partNumber: index + 1, etag })
      } catch (err) {
        if (attempt < MAX_CHUNK_RETRIES) {
          chunkProgress[index] = 0
          emitProgress()
          const delay = (attempt + 1) ** 2 * RETRY_BASE_DELAY
          await new Promise((r) => setTimeout(r, delay))
          return uploadSingleChunk(index, blob, attempt + 1)
        }
        throw err
      }
    }

    const queue = Array.from({ length: totalChunks }, (_, i) => i)

    async function worker() {
      while (queue.length > 0) {
        const i = queue.shift()!
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const blob = file.slice(start, end)
        await uploadSingleChunk(i, blob)
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    try {
      await Promise.all(workers)
    } catch {
      await fetch('/api/v1/files/upload/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key }),
      }).catch(() => {})
      throw new Error('Upload aborted')
    }
    parts.sort((a, b) => a.partNumber - b.partNumber)

    const res = await fetch('/api/v1/files/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        key,
        parts,
        name: file.name,
        parentId,
        mimeType: file.type,
      }),
    })
    if (!res.ok) throw new Error('Failed to complete multipart upload')
    onProgress?.(UPLOAD_DONE_PERCENT)
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
          await uploadFile(file, parentId, task.id, (percent) => {
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
