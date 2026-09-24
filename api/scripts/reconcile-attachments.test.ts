import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AttachmentObjectStorage } from "./attachment-object-storage"
import {
  buildAttachmentRowQuery,
  readReconciliationState,
  reconcileAttachments,
  writeReconciliationState,
  type AttachmentRowSource,
} from "./reconcile-attachments"

function storageWith(keys: ReadonlyArray<string>, failOn?: string): AttachmentObjectStorage {
  return {
    list: async () => ({ objects: [] }),
    read: async () => new Uint8Array(),
    write: async () => undefined,
    exists: async (key) => {
      if (key === failOn) throw new Error("head failed")
      return keys.includes(key)
    },
  }
}

const ids = ["a1", "a2", "a3", "a4", "a5"]

const rows: AttachmentRowSource = async (cursor, limit) =>
  ids
    .filter((id) => id > cursor)
    .slice(0, limit)
    .map((id) => ({ id, objectKey: `att/${id}` }))

describe("reconcileAttachments", () => {
  test("id順にHEADし、欠損したidだけを返して一巡したらcursorを戻す", async () => {
    const verified: Array<string> = []
    const result = await reconcileAttachments({
      rows,
      storage: storageWith(["att/a1", "att/a2", "att/a4", "att/a5"]),
      cursor: "",
      chunkSize: 2,
      maxChunks: 10,
      onChunkVerified: (cursor) => verified.push(cursor),
    })
    expect(result).toEqual({
      checked: 5,
      missingAttachmentIds: ["a3"],
      cursor: "",
      sweepCompleted: true,
    })
    expect(verified).toEqual(["a2", "a4", ""])
  })

  test("chunk数の上限で止まり、続きのcursorを返す", async () => {
    const result = await reconcileAttachments({
      rows,
      storage: storageWith(ids.map((id) => `att/${id}`)),
      cursor: "a1",
      chunkSize: 2,
      maxChunks: 1,
      onChunkVerified: () => undefined,
    })
    expect(result).toEqual({
      checked: 2,
      missingAttachmentIds: [],
      cursor: "a3",
      sweepCompleted: false,
    })
  })

  test("HEADに失敗したchunkではcursorを進めない", async () => {
    const verified: Array<string> = []
    const failure = await reconcileAttachments({
      rows,
      storage: storageWith(
        ids.map((id) => `att/${id}`),
        "att/a3",
      ),
      cursor: "",
      chunkSize: 2,
      maxChunks: 10,
      onChunkVerified: (cursor) => verified.push(cursor),
    }).catch((cause: unknown) => cause)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe("head failed")
    expect(verified).toEqual(["a2"])
  })

  test("規約外のobject keyは欠損として扱う", async () => {
    const result = await reconcileAttachments({
      rows: async (cursor) => (cursor === "" ? [{ id: "a1", objectKey: "other/a1" }] : []),
      storage: storageWith(["other/a1"]),
      cursor: "",
      chunkSize: 2,
      maxChunks: 1,
      onChunkVerified: () => undefined,
    })
    expect(result.missingAttachmentIds).toEqual(["a1"])
  })
})

describe("buildAttachmentRowQuery", () => {
  test("cursorと件数を検査してからqueryへ埋め込む", () => {
    expect(buildAttachmentRowQuery("a1", 100)).toBe(
      "SELECT id, object_key FROM system_attachments WHERE status IN ('pending', 'linked') AND id > 'a1' ORDER BY id LIMIT 100",
    )
    expect(buildAttachmentRowQuery("a1' OR '1'='1", 100)).toBeInstanceOf(Error)
    expect(buildAttachmentRowQuery("a1", 0)).toBeInstanceOf(Error)
  })
})

describe("reconciliation state", () => {
  test("状態fileが無ければ先頭から始め、書いた状態を読み戻せる", () => {
    const path = join(mkdtempSync(join(tmpdir(), "reconcile-")), "state.json")
    expect(readReconciliationState(path)).toEqual({ cursor: "", consecutiveFailures: 0 })
    writeReconciliationState(path, { cursor: "a2", consecutiveFailures: 1 })
    expect(readReconciliationState(path)).toEqual({ cursor: "a2", consecutiveFailures: 1 })
  })
})
