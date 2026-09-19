import { collectRunners, exportedRunner, renderJobs } from "./gen-scheduled"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("定期起動の一覧の生成", () => {
  test("runScheduled で始まる関数を一つだけ持つrunnerを受け付ける", () => {
    const source = "export async function runScheduledExample(\n  input: Input,\n) {}\n"

    expect(exportedRunner("run-example.ts", source)).toEqual({
      file: "run-example.ts",
      name: "runScheduledExample",
    })
  })

  test("runnerのexportが無い、または複数あるファイルを拒否する", () => {
    expect(exportedRunner("run-none.ts", "export const value = 1\n")).toBeInstanceOf(Error)
    expect(
      exportedRunner(
        "run-two.ts",
        "export async function runScheduledA() {}\nexport async function runScheduledB() {}\n",
      ),
    ).toBeInstanceOf(Error)
  })

  test("ファイル名順に並べ、runnerが無い構成でも型の成立する一覧を生成する", () => {
    const rendered = renderJobs([
      { file: "run-zeta.ts", name: "runScheduledZeta" },
      { file: "run-alpha.ts", name: "runScheduledAlpha" },
    ])

    expect(rendered.indexOf("runScheduledAlpha")).toBeLessThan(rendered.indexOf("runScheduledZeta"))
    expect(rendered).toContain('from "@/api/scheduled/run-alpha"')
    expect(renderJobs([])).toContain("export const SCHEDULED_JOBS = [] as const")
  })

  test("現在の jobs.ts が生成結果と一致する", () => {
    const runners = collectRunners()
    if (runners instanceof Error) throw runners

    expect(readFileSync(resolve(import.meta.dir, "../src/api/scheduled/jobs.ts"), "utf8")).toBe(
      renderJobs(runners),
    )
  })
})
