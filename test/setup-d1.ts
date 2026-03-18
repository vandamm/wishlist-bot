// Patches D1Database.exec to handle multi-line SQL statements.
// Workerd's D1 exec splits SQL by newline, which breaks multi-line CREATE TABLE etc.
// This setup collapses multi-line statements into single lines before exec.
import { env } from 'cloudflare:test'

const origExec = env.DB.exec.bind(env.DB)

;(env.DB as D1Database).exec = async function patchedExec(query: string) {
  // Collapse whitespace: join lines, normalize spaces
  const normalized = query
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
  return origExec(normalized)
}
