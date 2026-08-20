import { afterEach, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { checkApiCompositionRoutes } from "./check-api-composition-routes"

const temporaryProjects: string[] = []

function createTemporaryProject(
  groups: ReadonlyArray<{
    routePrefix: string
    participants: ReadonlyArray<string>
    routes: ReadonlyArray<string>
    reason: string
  }>,
  files: Readonly<Record<string, string>>,
): string {
  const projectRoot = mkdtempSync(resolve(tmpdir(), "bedrock-api-composition-"))
  temporaryProjects.push(projectRoot)
  writeFileSync(
    resolve(projectRoot, "api-route-composition.manifest.json"),
    JSON.stringify({ version: 2, groups }),
  )
  for (const [path, source] of Object.entries(files)) {
    const absolutePath = resolve(projectRoot, path)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, source)
  }
  return projectRoot
}

afterEach(() => {
  for (const projectRoot of temporaryProjects.splice(0)) {
    rmSync(projectRoot, { force: true, recursive: true })
  }
})

test("API rootの全routeを複数context compositionとして明示する", async () => {
  expect(await checkApiCompositionRoutes()).toEqual([])
})

test("未宣言route・nested route・basenameが一致しないtestを拒否する", async () => {
  const projectRoot = createTemporaryProject(
    [
      {
        routePrefix: "auth",
        participants: ["company", "system"],
        routes: ["auth"],
        reason: "認証を合成する",
      },
    ],
    {
      "src/api/routes/auth.ts": 'import "@/contexts/company/domain/account"',
      "src/api/routes/auth.profile.test.ts": "",
      "src/api/routes/nested/auth.ts": "",
      "src/api/routes/unknown.ts": "",
    },
  )

  expect(await checkApiCompositionRoutes(projectRoot)).toEqual(
    expect.arrayContaining([
      "API composition routeはflatに配置してください: src/api/routes/nested/auth.ts",
      "未宣言のAPI composition routeです: src/api/routes/unknown.ts",
      "production routeとbasenameが一致しないtestです: src/api/routes/auth.profile.test.ts",
    ]),
  )
})

test("宣言外context importを拒否する", async () => {
  const projectRoot = createTemporaryProject(
    [
      {
        routePrefix: "auth",
        participants: ["company", "system"],
        routes: ["auth"],
        reason: "認証を合成する",
      },
    ],
    { "src/api/routes/auth.ts": 'import { POST } from "@/contexts/twit/interface/routes/login"' },
  )

  expect(await checkApiCompositionRoutes(projectRoot)).toContain(
    "src/api/routes/auth.ts の未宣言participant importです: twit",
  )
})

test("重複・未整列participantと実装のないrouteを拒否する", async () => {
  const projectRoot = createTemporaryProject(
    [
      {
        routePrefix: "auth",
        participants: ["system", "company", "system"],
        routes: ["auth"],
        reason: "認証を合成する",
      },
      {
        routePrefix: "unused",
        participants: ["company", "system"],
        routes: ["unused"],
        reason: "未実装",
      },
    ],
    { "src/api/routes/auth.ts": "" },
  )

  expect(await checkApiCompositionRoutes(projectRoot)).toEqual(
    expect.arrayContaining([
      "auth のparticipantsが重複しています",
      "auth のparticipantsは昇順で宣言してください",
      "manifestに実装のないAPI composition routeがあります: unused",
    ]),
  )
})

test("database直アクセス・Infrastructure import・補助関数を拒否する", async () => {
  const projectRoot = createTemporaryProject(
    [
      {
        routePrefix: "auth",
        participants: ["company", "system"],
        routes: ["auth"],
        reason: "認証を合成する",
      },
    ],
    {
      "src/api/routes/auth.ts": `
        import { users } from "@/contexts/company/infrastructure/schema/account-runtime"
        function helper() {}
        export const GET = async (context: any) => context.var.database.select().from(users)
      `,
    },
  )

  expect(await checkApiCompositionRoutes(projectRoot)).toEqual(
    expect.arrayContaining([
      "src/api/routes/auth.ts がAPI routeからdatabaseへ直接アクセスしています",
      "src/api/routes/auth.ts がContext Infrastructureを直接importしています",
      "src/api/routes/auth.ts がroute handler以外の関数またはclassを定義しています",
    ]),
  )
})
