import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const contextsDirectory = new URL(".", import.meta.url)
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

function usesDomainModel(source: string): boolean {
  if (source.includes("/domain/")) return true

  const repositoryModules = [
    ...[...source.matchAll(/from "@\/contexts\/([^\"]+\/infrastructure\/[^\"]+)"/g)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/from "@system\/(infrastructure\/[^\"]+)"/g)].map(
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
  test("Infrastructureのproduction実装はrepository fileだけにする", () => {
    expect(
      productionFiles.filter(
        (file) => file.includes("/infrastructure/") && !file.endsWith(".repository.ts"),
      ),
    ).toEqual([])
  })

  test("Applicationは1ファイル1操作でDomain modelを経由する", () => {
    const operationName =
      /^(?:Add|Advance|Analyze|Apply|Approve|Archive|Assign|Authenticate|Backfill|Bootstrap|Cancel|Change|Check|Clock|Close|Complete|Create|Decide|Delete|Disclose|Dispose|Download|Enroll|Exchange|Export|Fetch|Find|Generate|Get|Issue|Lend|List|Manage|Mark|Preview|Process|Provision|Publish|Query|Read|Rebuild|Register|Remove|Request|Reset|Reschedule|Resolve|Return|Revoke|Rotate|Search|Send|Set|Start|Store|Submit|Supersede|Sync|Transition|Uncomplete|Update|Verify|View|Withdraw|Write)|Service$/i
    const violations = productionFiles
      .filter((file) => file.includes("/application/") && !file.endsWith("errors.ts"))
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
            .filter((name) => !operationName.test(name))
            .map((name) => `${file}: invalid operation name ${name}`),
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
