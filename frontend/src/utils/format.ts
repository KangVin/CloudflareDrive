/** Size units for human-readable display */
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const

const BYTES_PER_KB = 1024

/** Format bytes to a human-readable string (e.g. "1.5 MB") */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '-'
  let i = 0
  let size = bytes
  while (size >= BYTES_PER_KB && i < SIZE_UNITS.length - 1) {
    size /= BYTES_PER_KB
    i++
  }
  return `${size.toFixed(1)} ${SIZE_UNITS[i]}`
}
