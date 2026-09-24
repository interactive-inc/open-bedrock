import childProcess from "node:child_process"
import type { ChildProcess } from "node:child_process"

let installed = false

const failures: unknown[] = []

/**
 * Miniflareが起動するworkerdの子プロセスについて、stdioの失敗を受け止める。
 *
 * Bunは子プロセスのpipeを作る時に接続へ失敗すると（ENOENTなど）、そのstreamへ`error`を送る。
 * Miniflareはこのstreamへ`error`の受け手を付けないため、失敗はtestの外で未処理のerrorになる。
 * ここではworkerdのspawn直後に全stdioへ受け手を付け、失敗を記録してworkerdを止める。
 * 止まったworkerdはMiniflareの起動を失敗させ、呼び出し側の起動の作り直しで扱われる。
 */
export function installWorkerdStdioGuard(): void {
  if (installed) return
  installed = true
  const spawn = childProcess.spawn
  const guarded = function (this: unknown, ...args: unknown[]) {
    const child = Reflect.apply(spawn, this, args) as ChildProcess
    if (isWorkerd(args[0])) guard(child)
    return child
  }
  childProcess.spawn = guarded as typeof spawn
}

/** これまでに記録したworkerdのstdioの失敗を取り出し、記録を空にする。 */
export function takeWorkerdStdioFailures(): unknown[] {
  return failures.splice(0)
}

function isWorkerd(command: unknown): boolean {
  return typeof command === "string" && /[\\/]workerd(?:\.exe)?$/.test(command)
}

function guard(child: ChildProcess): void {
  for (const stream of child.stdio) {
    stream?.on("error", (error: unknown) => {
      failures.push(error)
      child.kill("SIGKILL")
    })
  }
}
