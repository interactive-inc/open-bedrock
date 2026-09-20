import {
  COMPOSITION_LIST_TARGETS,
  collectParts,
  exportedPart,
  outputPath,
  renderList,
  type CompositionListTarget,
} from "./gen-composition-lists"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const target: CompositionListTarget = {
  directory: "scheduled",
  filePattern: /^run-[a-z0-9-]+\.ts$/u,
  exportPrefix: "runScheduled",
  output: "jobs.ts",
  listName: "SCHEDULED_JOBS",
  description: "example",
}

describe("API compositionの部品の一覧の生成", () => {
  test("接頭辞で始まる関数を一つだけ持つ部品を受け付ける", () => {
    const source = "export async function runScheduledExample(\n  input: Input,\n) {}\n"

    expect(exportedPart("run-example.ts", source, "runScheduled")).toEqual({
      file: "run-example.ts",
      name: "runScheduledExample",
    })
  })

  test("exportが無い、複数ある、接頭辞が違う部品を拒否する", () => {
    expect(exportedPart("run-none.ts", "export const value = 1\n", "runScheduled")).toBeInstanceOf(
      Error,
    )
    expect(
      exportedPart(
        "run-two.ts",
        "export async function runScheduledA() {}\nexport async function runScheduledB() {}\n",
        "runScheduled",
      ),
    ).toBeInstanceOf(Error)
    expect(
      exportedPart("expense.ts", "export async function runScheduledA() {}\n", "readInboxCounts"),
    ).toBeInstanceOf(Error)
  })

  test("ファイル名順に並べ、部品が無い構成でも型の成立する一覧を生成する", () => {
    const rendered = renderList(target, [
      { file: "run-zeta.ts", name: "runScheduledZeta" },
      { file: "run-alpha.ts", name: "runScheduledAlpha" },
    ])

    expect(rendered.indexOf("runScheduledAlpha")).toBeLessThan(rendered.indexOf("runScheduledZeta"))
    expect(rendered).toContain('from "@/api/scheduled/run-alpha"')
    expect(renderList(target, [])).toContain("export const SCHEDULED_JOBS = [] as const")
  })

  test("現在の一覧がすべて生成結果と一致する", () => {
    for (const current of COMPOSITION_LIST_TARGETS) {
      const parts = collectParts(current)
      if (parts instanceof Error) throw parts

      expect(readFileSync(outputPath(current), "utf8")).toBe(renderList(current, parts))
    }
  })
})
