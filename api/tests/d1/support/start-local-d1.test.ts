import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import type { Mock } from "bun:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type StartableRuntime, startRuntime } from "@tests/d1/support/start-local-d1"

type FakeRuntime = StartableRuntime &
  Readonly<{
    name: string
    resolve: () => void
    reject: (error: unknown) => void
    disposed: () => number
  }>

function fakeRuntime(name: string): FakeRuntime {
  let resolve: () => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const ready = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  let disposed = 0
  return {
    name,
    ready,
    resolve,
    reject,
    disposed: () => disposed,
    // Miniflareの停止と同じく、起動の失敗で停止も失敗させる。
    dispose: async () => {
      disposed += 1
      await ready
    },
  }
}

/** 投入した順に実行環境を返し、起動に使ったディレクトリ名を記録する。ディレクトリは作らない。 */
function factory(runtimes: ReadonlyArray<FakeRuntime>) {
  const root = join(tmpdir(), `start-runtime-test-${crypto.randomUUID()}`)
  const persists: string[] = []
  let next = 0
  return {
    persists,
    persistAt: (index: number) => join(root, `persist-${index}`),
    preparePersist: () => {
      const persist = join(root, `persist-${persists.length}`)
      persists.push(persist)
      return persist
    },
    create: () => {
      const runtime = runtimes[next]
      next += 1
      if (runtime === undefined) throw new Error("no fake runtime left")
      return runtime
    },
  }
}

/** 保留中のpromiseの続きを流す。 */
async function flush(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve()
}

let warn: Mock<typeof console.warn>

beforeEach(() => {
  warn = spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  warn.mockRestore()
})

describe("startRuntime", () => {
  test("起動が失敗したら新しいディレクトリで作り直し、失敗した実行環境を停止する", async () => {
    const failed = fakeRuntime("failed")
    const started = fakeRuntime("started")
    const runtimes = factory([failed, started])
    failed.reject(new Error("EBADF: bad file descriptor, send"))
    started.resolve()

    const result = await startRuntime(runtimes.preparePersist, {
      create: runtimes.create,
      restartDelaysMs: [0],
    })

    expect(result.runtime.name).toBe("started")
    expect(result.persist).toBe(runtimes.persistAt(1))
    expect(runtimes.persists).toEqual([runtimes.persistAt(0), runtimes.persistAt(1)])
    expect(failed.disposed()).toBe(1)
    expect(started.disposed()).toBe(0)
  })

  test("止まった起動を作り直した後で元の起動が失敗しても、未処理のrejectionにしない", async () => {
    const stalled = fakeRuntime("stalled")
    const started = fakeRuntime("started")
    const runtimes = factory([stalled, started])
    started.resolve()

    const result = await startRuntime(runtimes.preparePersist, {
      create: runtimes.create,
      stallMs: 1,
      restartDelaysMs: [0],
    })

    expect(result.runtime.name).toBe("started")
    expect(stalled.disposed()).toBe(1)

    const late = new Error("Failed to connect")
    stalled.reject(late)
    await flush()

    expect(warn.mock.calls.map((call) => call[0])).toContain(
      "local D1 runtime of abandoned attempt 1 failed later:",
    )
    expect(warn.mock.calls.find((call) => call[1] === late)).toBeDefined()
  })

  test("全ての起動が失敗したら最後の失敗を投げ、どの実行環境も停止する", async () => {
    const runtimes = [fakeRuntime("first"), fakeRuntime("second"), fakeRuntime("third")]
    const last = new Error("ENOENT: Failed to connect")
    const failures = [new Error("EBADF"), new Error("EBADF"), last]
    const created = factory(runtimes)
    let index = 0

    const failure = await startRuntime(created.preparePersist, {
      // 起動した時点で失敗させ、観測前のrejectionを作らない。
      create: () => {
        const runtime = created.create()
        runtime.reject(failures[index])
        index += 1
        return runtime
      },
      attempts: 3,
      restartDelaysMs: [0],
    }).then(
      () => null,
      (error: unknown) => error,
    )

    expect(failure).toBe(last)
    expect(runtimes.map((runtime) => runtime.disposed())).toEqual([1, 1, 1])
  })

  test("起動が成功した実行環境は停止しない", async () => {
    const started = fakeRuntime("started")
    started.resolve()
    const runtimes = factory([started])

    const result = await startRuntime(runtimes.preparePersist, {
      create: runtimes.create,
      restartDelaysMs: [0],
    })

    expect(result.runtime).toBe(started)
    expect(started.disposed()).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })
})
