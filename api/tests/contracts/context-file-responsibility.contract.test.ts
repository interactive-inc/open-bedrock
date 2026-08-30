import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

const contextsDirectory = new URL("../../src/contexts/", import.meta.url)
const productionFiles = [
  ...new Glob("*/{application,infrastructure}/**/*.ts").scanSync({
    cwd: contextsDirectory.pathname,
  }),
]
  .filter(
    (file) =>
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test-support.ts") &&
      !file.includes("/infrastructure/schema/"),
  )
  .sort()

const allContextProductionFiles = [
  ...new Glob("*/**/*.ts").scanSync({ cwd: contextsDirectory.pathname }),
]
  .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test-support.ts"))
  .sort()

function isLayerErrorFile(file: string, layer: "application" | "infrastructure"): boolean {
  return new RegExp(`/${layer}/(?:.*/)?errors\\.ts$`).test(file)
}

function isLayerLibFile(file: string, layer: "application" | "infrastructure"): boolean {
  return file.includes(`/${layer}/`) && file.includes("/lib/")
}

function usesDomainModel(source: string): boolean {
  if (source.includes("/domain/")) return true

  const repositoryModules = [
    ...[...source.matchAll(/from "@\/contexts\/([^"]+\/infrastructure\/[^"]+)"/g)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/from "@system\/(infrastructure\/[^"]+)"/g)].map(
      (match) => `system/${match[1]}`,
    ),
  ].filter((module): module is string => module !== undefined)

  return repositoryModules.some((module) => {
    const repository = resolve(contextsDirectory.pathname, `${module}.ts`)

    try {
      return readFileSync(repository, "utf8").includes("/domain/")
    } catch {
      return false
    }
  })
}

describe("Context file responsibility contract", () => {
  test("contexts直下はbounded context directoryとCLAUDE.mdだけにする", () => {
    const violations = readdirSync(contextsDirectory, { withFileTypes: true })
      .filter((entry) => !entry.isDirectory() && entry.name !== "CLAUDE.md")
      .map((entry) => entry.name)

    expect(violations).toEqual([])
  })

  test("context内のAI向け説明はREADME.mdでなくCLAUDE.mdに置く", () => {
    expect([...new Glob("**/README.md").scanSync({ cwd: contextsDirectory.pathname })]).toEqual([])
  })

  test("Infrastructureのproduction実装をrepositoryとadapterへ明示分類する", () => {
    expect(
      productionFiles.filter(
        (file) =>
          file.includes("/infrastructure/") &&
          !file.endsWith(".repository.ts") &&
          !(file.includes("/infrastructure/adapters/") && file.endsWith(".adapter.ts")) &&
          !isLayerErrorFile(file, "infrastructure") &&
          !isLayerLibFile(file, "infrastructure"),
      ),
    ).toEqual([])
  })

  test("Applicationは1ファイル1操作でDomain modelを経由する", () => {
    const ambiguousOperationName =
      /^(?:Advance|Decide|Handle|Manage|Process|Save|Transition|Upsert|Write)(?:$|[A-Z])/
    const violations = productionFiles
      .filter(
        (file) =>
          file.includes("/application/") &&
          !isLayerErrorFile(file, "application") &&
          !isLayerLibFile(file, "application"),
      )
      .flatMap((file) => {
        const source = readFileSync(new URL(file, contextsDirectory), "utf8")
        const classes = [...source.matchAll(/^export class (?!\w*Error\b)(\w+)/gm)].map(
          (match) => match[1]!,
        )
        const functions = [
          ...source.matchAll(
            /^export (?:async )?function (\w+)|^export const (\w+)\s*=\s*(?:async\s*)?\(/gm,
          ),
        ].map((match) => match[1] ?? match[2]!)

        return [
          ...(classes.length + functions.length === 1
            ? []
            : [`${file}: operation count=${classes.length + functions.length}`]),
          ...[...classes, ...functions]
            .filter((name) => ambiguousOperationName.test(name))
            .map((name) => `${file}: ambiguous operation name ${name}`),
          ...(usesDomainModel(source) ? [] : [`${file}: Domain model is not used`]),
          ...(/usecase/i.test(source) ? [`${file}: useCase naming`] : []),
        ]
      })

    expect(violations).toEqual([])
  })

  test("operationをuseCaseと呼ばない", () => {
    const forbiddenName = new RegExp(`\\b${["use", "case"].join("")}\\b`, "i")

    expect(
      allContextProductionFiles.filter((file) =>
        forbiddenName.test(readFileSync(new URL(file, contextsDirectory), "utf8")),
      ),
    ).toEqual([])
  })
})
