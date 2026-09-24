import {
  collectSystemInfrastructureImports,
  inspectSystemInfrastructureImports,
} from "./check-system-infrastructure-imports"
import { describe, expect, test } from "bun:test"

const repository = "src/contexts/system/infrastructure/repositories/iam/system-role.repository"
const adapter = "src/contexts/system/infrastructure/adapters/auth/resolve-bearer-account.adapter"

describe("System infrastructure import検査", () => {
  test("aliasと相対pathを解決し、共有contextとinfrastructure以外のSystem importを除く", () => {
    const imports = collectSystemInfrastructureImports(
      new Map([
        [
          "src/contexts/room/infrastructure/room.adapter.ts",
          `import { A } from "@system/infrastructure/repositories/iam/system-role.repository"
import { B } from "@system/domain/schemas/iam/account-id.schema"
const C = await import("@/contexts/system/infrastructure/adapters/auth/resolve-bearer-account.adapter")`,
        ],
        [
          "src/api/http/verify.ts",
          'import { A } from "../../contexts/system/infrastructure/repositories/iam/system-role.repository"',
        ],
        [
          "src/contexts/company/infrastructure/company.adapter.ts",
          'import { A } from "@system/infrastructure/repositories/iam/system-role.repository"',
        ],
        [
          "src/contexts/system/interface/routes/system.roles.ts",
          'import { A } from "@system/infrastructure/repositories/iam/system-role.repository"',
        ],
      ]),
    )

    expect(Object.fromEntries(imports)).toEqual({
      "src/api/http/verify.ts": [repository],
      "src/contexts/room/infrastructure/room.adapter.ts": [adapter, repository],
    })
  })

  test("基準線に無い依存を拒否し、解消済みの依存は基準線からの削除を求める", () => {
    const violations = inspectSystemInfrastructureImports(
      new Map([
        ["src/contexts/room/a.ts", [repository, adapter]],
        ["src/contexts/room/new.ts", [repository]],
      ]),
      {
        imports: {
          "src/contexts/room/a.ts": [repository],
          "src/contexts/room/removed.ts": [adapter],
        },
      },
    )

    expect(violations.map((violation) => violation.file)).toEqual([
      "src/contexts/room/a.ts",
      "src/contexts/room/new.ts",
      "src/contexts/room/removed.ts",
    ])
    expect(violations[0]?.reason).toContain("新しい依存")
    expect(violations[2]?.reason).toContain("無くなりました")
  })

  test("test fileでspyへ差し替えるだけのimportは数えず、生成や値の受け渡しは数える", () => {
    const spyOnly = `import { A } from "@system/infrastructure/repositories/iam/system-role.repository"
const original = A.prototype.find
spyOn(A.prototype, "find").mockImplementation(async function (this: A, id) {
  return original.call(this, id)
})`
    const constructed = `import { A } from "@system/infrastructure/repositories/iam/system-role.repository"
spyOn(A.prototype, "find")
const repository = new A(context)`
    const notSpied = `import { A } from "@system/infrastructure/repositories/iam/system-role.repository"
const original = A.prototype.find`
    const partial = `import { A, B } from "@system/infrastructure/repositories/iam/system-role.repository"
spyOn(A.prototype, "find")`
    const imports = collectSystemInfrastructureImports(
      new Map([
        ["src/contexts/room/test/spy-only.integration.test.ts", spyOnly],
        ["src/contexts/room/test/constructed.integration.test.ts", constructed],
        ["src/contexts/room/test/not-spied.integration.test.ts", notSpied],
        ["src/contexts/room/test/partial.integration.test.ts", partial],
        ["src/contexts/room/test/spy.test-support.ts", spyOnly],
        ["src/contexts/room/infrastructure/spy.adapter.ts", spyOnly],
      ]),
    )

    expect([...imports.keys()].sort()).toEqual([
      "src/contexts/room/infrastructure/spy.adapter.ts",
      "src/contexts/room/test/constructed.integration.test.ts",
      "src/contexts/room/test/not-spied.integration.test.ts",
      "src/contexts/room/test/partial.integration.test.ts",
      "src/contexts/room/test/spy.test-support.ts",
    ])
  })

  test("基準線と一致すれば違反は無い", () => {
    expect(
      inspectSystemInfrastructureImports(new Map([["src/api/a.ts", [repository]]]), {
        imports: { "src/api/a.ts": [repository] },
      }),
    ).toEqual([])
  })
})
