import type { FileRecord, CreateFileInput, UpdateFileInput } from '../types/models'

function mapRow(row: Record<string, unknown>): FileRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    parentId: row.parent_id as string | null,
    type: row.type as 'file' | 'folder',
    mimeType: row.mime_type as string | null,
    size: row.size as number,
    hash: row.hash as string | null,
    r2Key: row.r2_key as string | null,
    isTrashed: Boolean(row.is_trashed),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function createFileRepository(db: D1Database) {
  async function findByParent(parentId: string | null): Promise<FileRecord[]> {
    if (parentId === null) {
      const { results } = await db
        .prepare('SELECT * FROM files WHERE parent_id IS NULL AND is_trashed = 0 ORDER BY type DESC, name ASC')
        .all()
      return results.map(mapRow)
    }
    const { results } = await db
      .prepare('SELECT * FROM files WHERE parent_id = ? AND is_trashed = 0 ORDER BY type DESC, name ASC')
      .bind(parentId)
      .all()
    return results.map(mapRow)
  }

  async function findById(id: string): Promise<FileRecord | null> {
    const row = await db.prepare('SELECT * FROM files WHERE id = ?').bind(id).first()
    return row ? mapRow(row as Record<string, unknown>) : null
  }

  async function create(input: CreateFileInput): Promise<FileRecord> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO files (id, name, parent_id, type, mime_type, size, hash, r2_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.name,
        input.parentId,
        input.type,
        input.mimeType,
        input.size,
        input.hash ?? null,
        input.r2Key,
        now,
        now,
      )
      .run()
    return (await findById(id))!
  }

  async function update(id: string, input: UpdateFileInput): Promise<FileRecord> {
    const now = new Date().toISOString()
    const sets: string[] = ['updated_at = ?']
    const values: unknown[] = [now]
    if (input.name !== undefined) {
      sets.push('name = ?')
      values.push(input.name)
    }
    if (input.parentId !== undefined) {
      sets.push('parent_id = ?')
      values.push(input.parentId)
    }
    if (input.mimeType !== undefined) {
      sets.push('mime_type = ?')
      values.push(input.mimeType)
    }
    if (input.size !== undefined) {
      sets.push('size = ?')
      values.push(input.size)
    }
    if (input.r2Key !== undefined) {
      sets.push('r2_key = ?')
      values.push(input.r2Key)
    }
    if (input.hash !== undefined) {
      sets.push('hash = ?')
      values.push(input.hash)
    }
    values.push(id)
    await db
      .prepare(`UPDATE files SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
    return (await findById(id))!
  }

  async function softDelete(id: string): Promise<void> {
    const now = new Date().toISOString()
    await db.prepare('UPDATE files SET is_trashed = 1, updated_at = ? WHERE id = ?').bind(now, id).run()
  }

  async function restore(id: string): Promise<void> {
    const now = new Date().toISOString()
    await db.prepare('UPDATE files SET is_trashed = 0, updated_at = ? WHERE id = ?').bind(now, id).run()
  }

  async function findTrashed(): Promise<FileRecord[]> {
    const { results } = await db.prepare('SELECT * FROM files WHERE is_trashed = 1 ORDER BY updated_at DESC').all()
    return results.map(mapRow)
  }

  async function findByParentIncludingTrashed(parentId: string): Promise<FileRecord[]> {
    const { results } = await db
      .prepare('SELECT * FROM files WHERE parent_id = ? ORDER BY type DESC, name ASC')
      .bind(parentId)
      .all()
    return results.map(mapRow)
  }

  async function countByR2Key(r2Key: string, excludeId?: string): Promise<number> {
    const query = excludeId
      ? 'SELECT COUNT(*) AS count FROM files WHERE r2_key = ? AND id != ?'
      : 'SELECT COUNT(*) AS count FROM files WHERE r2_key = ?'
    const stmt = excludeId ? db.prepare(query).bind(r2Key, excludeId) : db.prepare(query).bind(r2Key)
    const row = await stmt.first<{ count: number }>()
    return row?.count ?? 0
  }

  async function hardDelete(id: string): Promise<void> {
    await db.prepare('DELETE FROM files WHERE id = ?').bind(id).run()
  }

  async function findByHash(hash: string): Promise<FileRecord | null> {
    const row = await db
      .prepare('SELECT * FROM files WHERE hash = ? AND is_trashed = 0 ORDER BY created_at DESC')
      .bind(hash)
      .first()
    return row ? mapRow(row as Record<string, unknown>) : null
  }

  async function search(query: string): Promise<FileRecord[]> {
    const { results } = await db
      .prepare('SELECT * FROM files WHERE name LIKE ? AND is_trashed = 0 ORDER BY type DESC, name ASC')
      .bind(`%${query}%`)
      .all()
    return results.map(mapRow)
  }

  return {
    findByParent,
    findById,
    findByHash,
    create,
    update,
    softDelete,
    restore,
    findTrashed,
    findByParentIncludingTrashed,
    hardDelete,
    countByR2Key,
    search,
  }
}
