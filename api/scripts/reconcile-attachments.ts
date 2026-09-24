import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import process from "node:process"
import { z } from "zod"
import {
  ATTACHMENT_OBJECT_KEY,
  createS3AttachmentObjectStorage,
  readAttachmentStorageConfig,
  type AttachmentObjectStorage,
} from "./attachment-object-storage"
import { fetchRemoteD1Rows } from "./fetch-remote-d1-rows"

/**
 * DBの添付行をid順に辿り、本体objectの実在を確認する。object storageの全件listは使わない。
 * 状態fileのcursorは、全行のHEADが完了したchunkの末尾だけへ進める。末尾まで辿ったら先頭へ戻す。
 * 照合は読み取りだけで副作用が無いため、失敗時は再実行だけで回復する。
 * 欠損は添付idだけを通知し、ファイル名、保存先、鍵を出力しない。
 */

const ATTACHMENT_ID = /^[0-9A-Za-z-]{1,128}$/

const zAttachmentRow = z.strictObject({
  id: z.string().regex(ATTACHMENT_ID),
  object_key: z.string(),
})

const zReconciliationState = z.strictObject({
  cursor: z.string().regex(/^[0-9A-Za-z-]{0,128}$/),
  consecutiveFailures: z.number().int().nonnegative(),
})

export type ReconciliationState = z.infer<typeof zReconciliationState>

export type AttachmentRowSource = (
  cursor: string,
  limit: number,
) => Promise<ReadonlyArray<Readonly<{ id: string; objectKey: string }>>>

export type ReconciliationResult = Readonly<{
  checked: number
  missingAttachmentIds: ReadonlyArray<string>
  cursor: string
  sweepCompleted: boolean
}>

export function buildAttachmentRowQuery(cursor: string, limit: number): string | Error {
  if (!/^[0-9A-Za-z-]{0,128}$/.test(cursor)) return new Error("cursor is invalid")
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return new Error("limit is invalid")
  return `SELECT id, object_key FROM system_attachments WHERE status IN ('pending', 'linked') AND id > '${cursor}' ORDER BY id LIMIT ${limit}`
}

/**
 * 最大 `maxChunks` 個のchunkを照合する。HEADが一件でも失敗したchunkではcursorを進めず、
 * 例外をそのまま返す。呼び出し側は例外時に状態fileの失敗回数だけを増やす。
 */
export async function reconcileAttachments(input: {
  rows: AttachmentRowSource
  storage: AttachmentObjectStorage
  cursor: string
  chunkSize: number
  maxChunks: number
  onChunkVerified: (cursor: string) => void
}): Promise<ReconciliationResult> {
  const missingAttachmentIds: Array<string> = []
  let cursor = input.cursor
  let checked = 0
  for (let chunk = 0; chunk < input.maxChunks; chunk += 1) {
    const rows = await input.rows(cursor, input.chunkSize)
    for (const row of rows) {
      if (
        !ATTACHMENT_OBJECT_KEY.test(row.objectKey) ||
        !(await input.storage.exists(row.objectKey))
      )
        missingAttachmentIds.push(row.id)
    }
    checked += rows.length
    const last = rows.at(-1)
    if (rows.length < input.chunkSize || last === undefined) {
      input.onChunkVerified("")
      return { checked, missingAttachmentIds, cursor: "", sweepCompleted: true }
    }
    cursor = last.id
    input.onChunkVerified(cursor)
  }
  return { checked, missingAttachmentIds, cursor, sweepCompleted: false }
}

export function readReconciliationState(path: string): ReconciliationState | Error {
  if (!existsSync(path)) return { cursor: "", consecutiveFailures: 0 }
  const parsed = zReconciliationState.safeParse(JSON.parse(readFileSync(path, "utf8")))
  if (!parsed.success) return new Error("reconciliation state file is invalid")
  return parsed.data
}

export function writeReconciliationState(path: string, state: ReconciliationState): void {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, `${JSON.stringify(state)}\n`)
  renameSync(temporary, path)
}

function readPositiveInteger(value: string | undefined, fallback: number, max: number) {
  if (value === undefined || value.trim() === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return null
  return parsed
}

async function notify(url: string | undefined, body: Record<string, unknown>): Promise<void> {
  if (url === undefined || url.trim() === "") return
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`notification failed (${response.status})`)
}

async function main(): Promise<number> {
  const storageConfig = readAttachmentStorageConfig(process.env, "ATTACHMENT_RECONCILE_STORAGE")
  const statePath = process.env.ATTACHMENT_RECONCILE_STATE_FILE?.trim() ?? ""
  if (storageConfig === null && statePath === "") {
    console.log("attachment reconciliation is disabled")
    return 0
  }
  if (storageConfig instanceof Error) {
    console.error(storageConfig.message)
    return 1
  }
  if (storageConfig === null || statePath === "") {
    console.error("attachment reconciliation requires storage and ATTACHMENT_RECONCILE_STATE_FILE")
    return 1
  }
  const chunkSize = readPositiveInteger(process.env.ATTACHMENT_RECONCILE_CHUNK_SIZE, 100, 1000)
  const maxChunks = readPositiveInteger(process.env.ATTACHMENT_RECONCILE_MAX_CHUNKS, 10, 10_000)
  const failureThreshold = readPositiveInteger(
    process.env.ATTACHMENT_RECONCILE_FAILURE_THRESHOLD,
    3,
    1000,
  )
  if (chunkSize === null || maxChunks === null || failureThreshold === null) {
    console.error("attachment reconciliation limits are invalid")
    return 1
  }
  const state = readReconciliationState(statePath)
  if (state instanceof Error) {
    console.error(state.message)
    return 1
  }
  const webhook = process.env.ATTACHMENT_RECONCILE_WEBHOOK_URL
  const binding = process.env.ATTACHMENT_RECONCILE_D1_BINDING?.trim() || "bedrock"
  const configPath = process.env.ATTACHMENT_RECONCILE_WRANGLER_CONFIG?.trim() || "wrangler.jsonc"
  let cursor = state.cursor
  try {
    const result = await reconcileAttachments({
      rows: async (after, limit) => {
        const query = buildAttachmentRowQuery(after, limit)
        if (query instanceof Error) throw query
        const rows = await fetchRemoteD1Rows({ binding, configPath, query })
        if (rows === null) throw new Error("attachment rows are unavailable")
        return z
          .array(zAttachmentRow)
          .parse(rows)
          .map((row) => ({ id: row.id, objectKey: row.object_key }))
      },
      storage: createS3AttachmentObjectStorage(storageConfig),
      cursor,
      chunkSize,
      maxChunks,
      onChunkVerified: (next) => {
        cursor = next
        writeReconciliationState(statePath, { cursor, consecutiveFailures: 0 })
      },
    })
    console.log(
      `attachment reconciliation completed: checked=${result.checked} missing=${result.missingAttachmentIds.length} sweep_completed=${result.sweepCompleted}`,
    )
    if (result.missingAttachmentIds.length === 0) return 0
    console.error(`missing attachment ids: ${result.missingAttachmentIds.join(",")}`)
    await notify(webhook, {
      event: "attachment.reconciliation.missing",
      missing_attachment_ids: result.missingAttachmentIds,
      checked: result.checked,
    })
    return 2
  } catch (cause) {
    const consecutiveFailures = state.consecutiveFailures + 1
    writeReconciliationState(statePath, { cursor, consecutiveFailures })
    console.error(
      `attachment reconciliation failed: ${cause instanceof Error ? cause.message : "unknown"} (consecutive=${consecutiveFailures})`,
    )
    if (consecutiveFailures >= failureThreshold)
      await notify(webhook, {
        event: "attachment.reconciliation.failed",
        consecutive_failures: consecutiveFailures,
      }).catch(() => console.error("attachment reconciliation failure notification failed"))
    return 1
  }
}

if (import.meta.main) {
  process.exitCode = await main()
}
