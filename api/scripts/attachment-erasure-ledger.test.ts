import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildDestroyedAuditQuery,
  buildReapplyStatement,
  exportErasures,
  readLedger,
  reapplyErasures,
  toLedgerEntry,
} from "./attachment-erasure-ledger"

const requestId = "11111111-1111-4111-8111-111111111111"
const directories: string[] = []

function ledgerPath() {
  const directory = mkdtempSync(join(tmpdir(), "erasure-ledger-"))
  directories.push(directory)
  return join(directory, "ledger.jsonl")
}

function auditRow(eventId: string, occurredAt: number, attachmentIds: ReadonlyArray<string>) {
  return {
    event_id: eventId,
    target_id: requestId,
    occurred_at: occurredAt,
    after_json: JSON.stringify({
      requestId,
      scope: { kind: "attachment", attachmentId: attachmentIds[0] },
      attachmentIds,
      erasedAt: new Date(occurredAt).toISOString(),
    }),
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("attachment erasure ledger", () => {
  test("破棄の監査行をledgerへ変換し、崩れた行や別申請の行は推測しない", () => {
    expect(toLedgerEntry(auditRow("event-1", 1_000, ["att-1"]))).toEqual({
      eventId: "event-1",
      requestId,
      occurredAt: new Date(1_000).toISOString(),
      erasedAt: new Date(1_000).toISOString(),
      attachmentIds: ["att-1"],
    })
    expect(
      toLedgerEntry({ ...auditRow("event-2", 1_000, ["att-1"]), after_json: "{" }),
    ).toBeInstanceOf(Error)
    expect(
      toLedgerEntry({ ...auditRow("event-3", 1_000, ["att-1"]), target_id: "other" }),
    ).toBeInstanceOf(Error)
    expect(toLedgerEntry(auditRow("event-4", 1_000, ["att/../x"]))).toBeInstanceOf(Error)
  })

  test("exportは新しい破棄だけを追記し、再実行しても重複させない", async () => {
    const path = ledgerPath()
    const rows = [
      auditRow("event-1", 1_000, ["att-1"]),
      auditRow("event-2", 2_000, ["att-2", "att-3"]),
    ]
    const queries: string[] = []
    const query = async (statement: string) => {
      queries.push(statement)
      return rows
    }
    const append = (target: string, lines: string) => writeFileSync(target, lines, { flag: "a" })

    expect(await exportErasures({ query, ledgerPath: path, append })).toEqual({ appended: 2 })
    expect(await exportErasures({ query, ledgerPath: path, append })).toEqual({ appended: 0 })
    const ledger = readLedger(path)
    if (ledger instanceof Error) throw ledger
    expect(ledger.map((entry) => entry.eventId)).toEqual(["event-1", "event-2"])
    expect(queries[1]).toContain("occurred_at >= 2000")
  })

  test("reapplyは記録済みの破棄だけを、鍵が残る行に限ってやり直す", async () => {
    const path = ledgerPath()
    const entry = toLedgerEntry(auditRow("event-1", 1_000, ["att-1", "att-2"]))
    if (entry instanceof Error) throw entry
    writeFileSync(path, `${JSON.stringify(entry)}\n`)
    const statements: string[] = []

    const reapplied = await reapplyErasures({
      ledgerPath: path,
      query: async (statement) => {
        statements.push(statement)
        return [{ id: "att-2" }]
      },
    })
    expect(reapplied).toEqual(["att-2"])
    expect(statements).toEqual([
      "UPDATE system_attachments SET status = 'erased', wrapped_dek = NULL, wrapped_dek_iv = NULL, erased_at = coalesce(erased_at, 1000) WHERE id IN ('att-1', 'att-2') AND wrapped_dek IS NOT NULL RETURNING id",
    ])
  })

  test("壊れたledgerを再適用の根拠にしない", async () => {
    const path = ledgerPath()
    writeFileSync(path, '{"eventId":"event-1"}\n')
    expect(readLedger(path)).toBeInstanceOf(Error)
    expect(await reapplyErasures({ ledgerPath: path, query: async () => [] })).toBeInstanceOf(Error)
    expect(readFileSync(path, "utf8")).toBe('{"eventId":"event-1"}\n')
  })

  test("不正なcursorとlimit、SQLへ混ぜられないidを拒否する", () => {
    expect(buildDestroyedAuditQuery(-1, 10)).toBeInstanceOf(Error)
    expect(buildDestroyedAuditQuery(0, 0)).toBeInstanceOf(Error)
    expect(
      buildReapplyStatement({
        eventId: "event-1",
        requestId,
        occurredAt: new Date(0).toISOString(),
        erasedAt: new Date(0).toISOString(),
        attachmentIds: ["x'); DROP TABLE system_attachments; --"],
      }),
    ).toBeInstanceOf(Error)
  })
})
