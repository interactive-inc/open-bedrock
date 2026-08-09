import { Glob } from "bun"
import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

const API_ROOT = resolve(import.meta.dir, "..")
const SYSTEM_ROOTS = [
  resolve(API_ROOT, "src/domain/system"),
  resolve(API_ROOT, "src/application/system"),
  resolve(API_ROOT, "src/infrastructure/system"),
] as const

const FORBIDDEN_VOCABULARY =
  /employee|employment|organization|department|company|facility|personnel|workforce|humanresource|thanks|shift|expense|leave|ringi|announcement|twit|chat|care/i

const CONTEXT_IMPORT = /from\s+["']@\/(domain|application|infrastructure)\/([^"']+)["']/g

export type SystemBoundaryViolation = Readonly<{
  file: string
  reason: string
}>

/** System 実装1ファイルに、上位コンテキストの語彙または依存が混入していないか調べる。 */
export function inspectSystemSource(file: string, source: string): SystemBoundaryViolation[] {
  const violations: SystemBoundaryViolation[] = []
  const forbiddenVocabulary = source.match(FORBIDDEN_VOCABULARY)?.[0]

  if (forbiddenVocabulary !== undefined) {
    violations.push({
      file,
      reason: `System に上位コンテキストの語彙 "${forbiddenVocabulary}" があります`,
    })
  }

  for (const match of source.matchAll(CONTEXT_IMPORT)) {
    const importedPath = match[2] ?? ""

    if (
      importedPath.startsWith("system/") === false &&
      importedPath.startsWith("shared/") === false
    ) {
      violations.push({
        file,
        reason: `System から上位コンテキストへ依存しています: ${match[0]}`,
      })
    }
  }

  return violations
}

export async function checkSystemContextBoundary(): Promise<SystemBoundaryViolation[]> {
  const violations: SystemBoundaryViolation[] = []

  for (const root of SYSTEM_ROOTS) {
    for await (const file of new Glob("**/*.ts").scan(root)) {
      if (file.endsWith(".test.ts")) {
        continue
      }

      const absoluteFile = resolve(root, file)
      violations.push(
        ...inspectSystemSource(
          relative(API_ROOT, absoluteFile),
          readFileSync(absoluteFile, "utf8"),
        ),
      )
    }
  }

  return violations
}

if (import.meta.main) {
  const violations = await checkSystemContextBoundary()

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}: ${violation.reason}`)
    }
    process.exit(1)
  }

  console.log("System context の依存境界を確認しました")
}
