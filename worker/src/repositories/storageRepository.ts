export function createStorageRepository(storage: R2Bucket) {
  async function upload(key: string, value: ReadableStream | ArrayBuffer | Blob) {
    return await storage.put(key, value)
  }

  async function download(key: string) {
    return await storage.get(key)
  }

  async function remove(key: string): Promise<void> {
    await storage.delete(key)
  }

  async function createMultipartUpload(key: string): Promise<R2MultipartUpload> {
    return await storage.createMultipartUpload(key)
  }

  function resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return storage.resumeMultipartUpload(key, uploadId)
  }

  async function uploadPart(
    mpu: R2MultipartUpload,
    partNumber: number,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
  ): Promise<R2UploadedPart> {
    return await mpu.uploadPart(partNumber, value)
  }

  async function completeMultipartUpload(mpu: R2MultipartUpload, parts: R2UploadedPart[]): Promise<R2Object> {
    return await mpu.complete(parts)
  }

  async function abortMultipartUpload(mpu: R2MultipartUpload): Promise<void> {
    await mpu.abort()
  }

  return {
    upload,
    download,
    remove,
    createMultipartUpload,
    resumeMultipartUpload,
    uploadPart,
    completeMultipartUpload,
    abortMultipartUpload,
  }
}
