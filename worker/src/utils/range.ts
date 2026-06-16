/** Parsed byte range from an HTTP Range header */
export interface RangeSpec {
  start: number
  end: number
}

/**
 * Parse an HTTP Range header value.
 * Supports bytes=start-end, bytes=start-, and bytes=-suffix formats.
 * Returns null if the header is absent, malformed, or the range is unsatisfiable.
 */
export function parseRangeHeader(header: string | null | undefined, fileSize: number): RangeSpec | null {
  if (!header) return null

  const match = header.trim().match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null

  let start = match[1] !== '' ? Number(match[1]) : undefined
  let end = match[2] !== '' ? Number(match[2]) : undefined

  if (start === undefined && end === undefined) return null
  if ((start !== undefined && isNaN(start)) || (end !== undefined && isNaN(end))) return null
  if (start !== undefined && start < 0) return null

  if (start === undefined) {
    start = Math.max(0, fileSize - end!)
    end = fileSize - 1
  } else if (end === undefined) {
    end = fileSize - 1
  }

  if (start >= fileSize || start > end) return null

  end = Math.min(end, fileSize - 1)

  return { start, end }
}
