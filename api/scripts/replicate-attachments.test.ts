import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AttachmentObjectStorage } from "./attachment-object-storage"
import { readAttachmentStorageConfig } from "./attachment-object-storage"
import {
  readOverlapMilliseconds,
  readReplicationState,
  replicateAttachments,
  writeReplicationState,
} from "./replicate-attachments"

class MemoryStorage implements AttachmentObjectStorage {
  readonly objects = new Map<string, { body: Uint8Array; lastModified: Date }>()
  readonly reads: Array<string> = []
  constructor(private readonly pageSize = 2) {}

  async list(input: { prefix: string; continuationToken?: string }) {
    const keys = [...this.objects.keys()].filter((key) => key.startsWith(input.prefix)).sort()
    const start = input.continuationToken === undefined ? 0 : Number(input.continuationToken)
    const page = keys.slice(start, start + this.pageSize)
    const next = start + this.pageSize
    return {
      objects: page.map((key) => ({
        key,
        lastModified: this.objects.get(key)?.lastModified ?? null,
      })),
      nextContinuationToken: next < keys.length ? String(next) : undefined,
    }
  }
  async read(key: string) {
    this.reads.push(key)
    const object = this.objects.get(key)
    if (object === undefined) throw new Error("missing")
    return object.body
  }
  async write(key: string, body: Uint8Array) {
    this.objects.set(key, { body, lastModified: new Date() })
  }
  async exists(key: string) {
    return this.objects.has(key)
  }
}

const old = new Date("2026-09-01T00:00:00.000Z")
const recent = new Date("2026-09-20T00:00:00.000Z")

function sourceWith(entries: ReadonlyArray<[string, Date]>) {
  const source = new MemoryStorage()
  for (const [key, lastModified] of entries)
    source.objects.set(key, { body: new TextEncoder().encode(`ciphertext:${key}`), lastModified })
  return source
}

describe("replicateAttachments", () => {
  test("初回はatt/の全objectを同じkeyと内容で複製先へ書く", async () => {
    const source = sourceWith([
      ["att/a", old],
      ["att/b", recent],
      ["att/c", recent],
    ])
    const target = new MemoryStorage()
    const result = await replicateAttachments({ source, target, since: null })
    expect(result.copied).toBe(3)
    expect([...target.objects.keys()].sort()).toEqual(["att/a", "att/b", "att/c"])
    expect(target.objects.get("att/b")?.body).toEqual(source.objects.get("att/b")?.body)
  })

  test("基準時刻より前のobjectと規約外のkeyは書かない", async () => {
    const source = sourceWith([
      ["att/a", old],
      ["att/b", recent],
      ["att/nested/c", recent],
    ])
    const target = new MemoryStorage()
    const result = await replicateAttachments({
      source,
      target,
      since: new Date("2026-09-10T00:00:00.000Z"),
    })
    expect(result).toMatchObject({ copied: 1, skipped: 2 })
    expect([...target.objects.keys()]).toEqual(["att/b"])
    expect(source.reads).toEqual(["att/b"])
  })

  test("書き込み失敗は例外として返し、呼び出し側が状態を進めない", async () => {
    const source = sourceWith([["att/a", recent]])
    const target = new MemoryStorage()
    target.write = async () => {
      throw new Error("denied")
    }
    const failure = await replicateAttachments({ source, target, since: null }).catch(
      (cause: unknown) => cause,
    )
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe("denied")
  })
})

describe("replication state", () => {
  test("状態fileが無ければ全件、書いた時刻を読み戻せる", () => {
    const path = join(mkdtempSync(join(tmpdir(), "replica-")), "state.json")
    expect(readReplicationState(path)).toBeNull()
    writeReplicationState(path, recent)
    expect(readReplicationState(path)).toEqual(recent)
    writeFileSync(path, JSON.stringify({ replicatedUntil: "yesterday" }))
    expect(readReplicationState(path)).toBeInstanceOf(Error)
  })

  test("重なり幅は既定60分で、不正値を拒否する", () => {
    expect(readOverlapMilliseconds(undefined)).toBe(3_600_000)
    expect(readOverlapMilliseconds("15")).toBe(900_000)
    expect(readOverlapMilliseconds("0")).toBeInstanceOf(Error)
    expect(readOverlapMilliseconds("1.5")).toBeInstanceOf(Error)
  })
})

describe("readAttachmentStorageConfig", () => {
  test("全て未設定なら無効、一部だけなら不足名を返す", () => {
    expect(readAttachmentStorageConfig({}, "X")).toBeNull()
    const partial = readAttachmentStorageConfig({ X_ENDPOINT: "https://storage.example.com" }, "X")
    expect(partial).toBeInstanceOf(Error)
    expect((partial as Error).message).toContain("X_BUCKET")
  })

  test("全て揃えば既定regionで接続設定を返す", () => {
    expect(
      readAttachmentStorageConfig(
        {
          X_ENDPOINT: "https://storage.example.com",
          X_BUCKET: "replica",
          X_ACCESS_KEY_ID: "id",
          X_SECRET_ACCESS_KEY: "secret",
        },
        "X",
      ),
    ).toEqual({
      endpoint: "https://storage.example.com",
      bucket: "replica",
      accessKeyId: "id",
      secretAccessKey: "secret",
      region: "auto",
    })
  })
})
