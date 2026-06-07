import type { ShareRecord, CreateShareInput } from '../types/models'

/** Share row with joined file name */
interface ShareRow extends ShareRecord {
  fileName: string
  fileType: 'file' | 'folder'
}

function mapRow(row: Record<string, unknown>): ShareRow {
  return {
    id: row.id as string,
    fileId: row.file_id as string,
    token: row.token as string,
    expiresAt: row.expires_at as string | null,
    createdAt: row.created_at as string,
    fileName: row.file_name as string,
    fileType: row.file_type as 'file' | 'folder',
  }
}

export function createShareRepository(db: D1Database) {
  async function findAll(): Promise<ShareRow[]> {
    const { results } = await db
      .prepare(
        `SELECT s.*, f.name AS file_name, f.type AS file_type
         FROM shares s
         JOIN files f ON f.id = s.file_id
         ORDER BY s.created_at DESC`,
      )
      .all()
    return results.map(mapRow)
  }

  async function findByToken(token: string): Promise<ShareRow | null> {
    const row = await db
      .prepare(
        `SELECT s.*, f.name AS file_name, f.type AS file_type
         FROM shares s
         JOIN files f ON f.id = s.file_id
         WHERE s.token = ?`,
      )
      .bind(token)
      .first()
    return row ? mapRow(row as Record<string, unknown>) : null
  }

  async function findById(id: string): Promise<ShareRow | null> {
    const row = await db
      .prepare(
        `SELECT s.*, f.name AS file_name, f.type AS file_type
         FROM shares s
         JOIN files f ON f.id = s.file_id
         WHERE s.id = ?`,
      )
      .bind(id)
      .first()
    return row ? mapRow(row as Record<string, unknown>) : null
  }

  async function create(input: CreateShareInput): Promise<ShareRecord> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO shares (id, file_id, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, input.fileId, input.token, input.expiresAt, now)
      .run()
    return { id, fileId: input.fileId, token: input.token, expiresAt: input.expiresAt, createdAt: now }
  }

  async function remove(id: string): Promise<void> {
    await db.prepare('DELETE FROM shares WHERE id = ?').bind(id).run()
  }

  return { findAll, findByToken, findById, create, remove }
}
