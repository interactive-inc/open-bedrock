import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"

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

describe("Context file responsibility contract", () => {
  test("Infrastructureのproduction実装はrepository fileだけにする", () => {
    expect(
      productionFiles.filter(
        (file) => file.includes("/infrastructure/") && !file.endsWith(".repository.ts"),
      ),
    ).toEqual([])
  })

  test("ApplicationはDomain modelを経由するwrite classだけにする", () => {
    const writeOperationName =
      /^(?:Add|Advance|Apply|Approve|Archive|Assign|Backfill|Bootstrap|Cancel|Change|Check|Clock|Close|Complete|Create|Decide|Delete|Disclose|Dispose|Enroll|Exchange|Issue|Lend|Manage|Mark|Process|Provision|Publish|Rebuild|Register|Remove|Request|Reset|Reschedule|Return|Revoke|Rotate|Send|Set|Start|Store|Submit|Supersede|Sync|Transition|Uncomplete|Update|Verify|Withdraw|Write)|Service$/
    const readOperationName =
      /^(?:Read|List|Get|Find|Resolve|Fetch|Query|Search|Download|Preview|Generate|Export|Authenticate|Analyze|View)/
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
          ...(classes.length === 1 ? [] : [`${file}: write class count=${classes.length}`]),
          ...classes.flatMap((name) => [
            ...(readOperationName.test(name) ? [`${file}: read operation ${name}`] : []),
            ...(writeOperationName.test(name) ? [] : [`${file}: non-write operation ${name}`]),
          ]),
          ...functions.map((name) => `${file}: exported function ${name}`),
          ...(source.includes("/domain/") ? [] : [`${file}: Domain model is not used`]),
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
