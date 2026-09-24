import { afterAll, expect, test } from "bun:test"
import childProcess from "node:child_process"
import { mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { once } from "node:events"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  installWorkerdStdioGuard,
  takeWorkerdStdioFailures,
} from "@tests/d1/support/guard-workerd-stdio"

const directory = mkdtempSync(join(tmpdir(), "guard-workerd-stdio-"))

afterAll(() => {
  rmSync(directory, { recursive: true, force: true })
})

/** workerdと同じ名前で起動する、入力を待ち続けるだけの実行ファイル。 */
function fakeWorkerd(): string {
  const path = join(directory, "workerd")
  symlinkSync("/bin/cat", path)
  return path
}

test("workerdのstdioの失敗を記録してworkerdを止め、未処理のerrorにしない", async () => {
  installWorkerdStdioGuard()
  takeWorkerdStdioFailures()
  const child = childProcess.spawn(fakeWorkerd(), [], { stdio: ["pipe", "pipe", "pipe", "pipe"] })
  const exited = once(child, "exit")
  const failure = new Error("Failed to connect")

  child.stdio[3]?.emit("error", failure)
  const [code, signal] = await exited

  expect(takeWorkerdStdioFailures()).toEqual([failure])
  expect(code).toBeNull()
  expect(signal).toBe("SIGKILL")
})

test("workerd以外の子プロセスのstdioには手を加えない", async () => {
  installWorkerdStdioGuard()
  const child = childProcess.spawn("/bin/cat", [], { stdio: ["pipe", "pipe", "pipe"] })
  const exited = once(child, "exit")

  expect(child.stdout?.listenerCount("error")).toBe(0)
  child.stdin?.end()
  const [code] = await exited

  expect(code).toBe(0)
  expect(takeWorkerdStdioFailures()).toEqual([])
})
