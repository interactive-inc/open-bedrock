import { expect, setDefaultTimeout, test } from "bun:test"
import { runningWorkerdPids, workerdExited } from "@tests/d1/support/guard-workerd-stdio"
import { startLocalD1 } from "@tests/d1/support/start-local-d1"

// ローカルD1のworkerd起動を含むため、既定の5秒では足りないことがある。
setDefaultTimeout(30_000)

test("共有のworkerdが止められた後のファイルは、新しいworkerdのDBを使う", async () => {
  const first = await startLocalD1({ empty: ["before-kill"] })
  const before = await first.database("before-kill")
  expect(await before.prepare("SELECT 1 AS one").first<number>("one")).toBe(1)
  const pid = runningWorkerdPids().at(-1)
  if (pid === undefined) throw new Error("workerd is not running")

  // bun test がtimeoutしたtestの子プロセスを止めるのと同じく、workerdを止める。
  process.kill(pid, "SIGKILL")
  await workerdExited(pid)
  await first.dispose()

  const second = await startLocalD1({ empty: ["after-kill"] })
  const after = await second.database("after-kill")

  expect(await after.prepare("SELECT 2 AS two").first<number>("two")).toBe(2)
  expect(runningWorkerdPids()).not.toContain(pid)
  await second.dispose()
})
