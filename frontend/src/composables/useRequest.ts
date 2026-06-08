import { ref, type Ref } from 'vue'

const inflightMap = new Map<string, Promise<unknown>>()

export interface UseRequestOptions<TArgs extends unknown[]> {
  lockKey?: string | ((...args: TArgs) => string)
}

export interface UseRequestReturn<TArgs extends unknown[], TResp> {
  loading: Ref<boolean>
  error: Ref<Error | null>
  execute: (...args: TArgs) => Promise<TResp>
}

export function useRequest<TArgs extends unknown[], TResp>(
  fn: (...args: TArgs) => Promise<TResp>,
  options?: UseRequestOptions<TArgs>,
): UseRequestReturn<TArgs, TResp> {
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function execute(...args: TArgs): Promise<TResp> {
    const rawKey = options?.lockKey
    const key = typeof rawKey === 'function' ? rawKey(...args) : rawKey

    if (key !== undefined) {
      const existing = inflightMap.get(key)
      if (existing) return existing as Promise<TResp>
    }

    error.value = null
    loading.value = true

    const promise = fn(...args).finally(() => {
      loading.value = false
      if (key !== undefined) {
        inflightMap.delete(key)
      }
    })

    if (key !== undefined) {
      inflightMap.set(key, promise)
    }

    return promise
  }

  return { loading, error, execute }
}
