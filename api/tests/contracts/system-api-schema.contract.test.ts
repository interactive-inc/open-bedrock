import { systemRouteManifest } from "@system/interface/route-manifest"
import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { z } from "zod"

const apiRoot = resolve(import.meta.dir, "../..")
const systemRoot = "src/contexts/system"

/** Systemが公開する応答schemaの置き場所。横断の集約fileは作らず、ここで走査する。 */
const responseSchemaGlobs = ["interface/http/*.ts", "interface/models/*.ts"] as const

function toSourcePath(module: string): string {
  return `${systemRoot}/${module.slice("@system/".length)}.ts`
}

/** handler直前の `// @authorization` 宣言を読む。宣言の変更もSystem APIの変更として扱う。 */
function readAuthorization(source: string, exportName: string): string | null {
  const lines = source.split("\n")
  const index = lines.findIndex((line) => line.startsWith(`export const ${exportName} =`))
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const line = lines[cursor]?.trim() ?? ""
    if (line.startsWith("// @authorization ")) return line.slice("// @authorization ".length)
    const isComment = line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")
    if (line !== "" && !isComment) return null
  }
  return null
}

async function collectResponseSchemas(): Promise<Record<string, unknown>> {
  const schemas: Record<string, unknown> = {}
  const files: string[] = []

  for (const pattern of responseSchemaGlobs) {
    for await (const file of new Glob(pattern).scan(resolve(apiRoot, systemRoot))) {
      if (!file.endsWith(".test.ts")) files.push(file)
    }
  }

  for (const file of files.sort()) {
    const exports = (await import(resolve(apiRoot, systemRoot, file))) as Record<string, unknown>
    for (const name of Object.keys(exports).sort()) {
      const value = exports[name]
      if (!(value instanceof z.ZodType)) continue
      schemas[`${file}#${name}`] = z.toJSONSchema(value, { io: "output", unrepresentable: "any" })
    }
  }

  return schemas
}

describe("System API schema snapshot", () => {
  // System全route moduleと応答schemaを読み込むため、既定の5秒より長く待つ。
  test("route表、認可宣言、応答schemaの変更は、snapshotの更新として明示する", async () => {
    const routes = systemRouteManifest
      .map((route) => {
        const source = readFileSync(resolve(apiRoot, toSourcePath(route.handler.module)), "utf8")
        return {
          method: route.method,
          path: route.path,
          phase: route.phase,
          module: route.handler.module,
          exportName: route.handler.exportName,
          authorization: readAuthorization(source, route.handler.exportName),
        }
      })
      .sort((left, right) =>
        `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`),
      )

    // 変更が意図どおりなら `bun test --update-snapshots tests/contracts/system-api-schema.contract.test.ts` で更新する。
    expect({ routes, responseSchemas: await collectResponseSchemas() }).toMatchSnapshot()
  }, 60_000)
})
