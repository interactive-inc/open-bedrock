import { Glob } from "bun"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const MIGRATION_LIST_PATH = resolve(PROJECT_ROOT, "test-database-wrapper-migration.json")
const SCANNED_ROOTS = ["src", "tests", "scripts"] as const

/** D1 APIをbun:sqliteで模倣する互換層。System・Company側はそれぞれのlockが内容を固定する。 */
export const WRAPPER_MODULES: ReadonlyArray<string> = [
  "tests/api/support/d1-test-database.ts",
  "src/contexts/company/test/d1-test-database.test-support.ts",
  "src/contexts/company/test/create-company-d1-test-database-template.test-support.ts",
  "src/contexts/system/test/create-system-d1-test-database.test-support.ts",
  "src/contexts/system/test/wrap-system-d1-test-database.test-support.ts",
]

/** 共有contextはそれぞれの正本に従うため、この移行一覧の対象外にする。 */
const LOCKED_CONTEXT_PREFIXES = ["src/contexts/system/", "src/contexts/company/"] as const

/** この製品が所有する互換層。移行中は内容を固定し、機能を足させない。 */
const OWNED_WRAPPER = "tests/api/support/d1-test-database.ts"

export const VERIFICATION_KINDS = ["business", "sql", "http", "support"] as const

export type VerificationKind = (typeof VERIFICATION_KINDS)[number]

const migrationListSchema = z.strictObject({
  ownedWrapperSha256: z.string().regex(/^[0-9a-f]{64}$/),
  dependents: z.strictObject({
    business: z.array(z.string().min(1)),
    sql: z.array(z.string().min(1)),
    http: z.array(z.string().min(1)),
    support: z.array(z.string().min(1)),
  }),
})

export type MigrationList = z.infer<typeof migrationListSchema>

export type WrapperViolation = Readonly<{
  file: string
  reason: string
}>

const ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["@system/", "src/contexts/system/"],
  ["@tests/", "tests/"],
  ["@/", "src/"],
]

/** import指定子をproject相対pathへ解決する。外部packageはnullを返す。 */
export function resolveImport(
  fromFile: string,
  specifier: string,
  exists: (path: string) => boolean,
): string | null {
  let base: string | null = null

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = relative(PROJECT_ROOT, resolve(PROJECT_ROOT, dirname(fromFile), specifier))
  } else {
    for (const [alias, target] of ALIASES) {
      if (specifier.startsWith(alias)) {
        base = `${target}${specifier.slice(alias.length)}`
        break
      }
    }
  }

  if (base === null) return null

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (exists(candidate)) return candidate
  }

  return null
}

function importSpecifiers(sourceText: string): string[] {
  return ts.preProcessFile(sourceText, true, true).importedFiles.map((file) => file.fileName)
}

/** 互換層へ直接または他のテスト部品経由で到達するファイルを返す。 */
export function collectWrapperDependents(sources: ReadonlyMap<string, string>): Set<string> {
  const importers = new Map<string, Set<string>>()

  for (const [file, text] of sources) {
    for (const specifier of importSpecifiers(text)) {
      const target = resolveImport(file, specifier, (path) => sources.has(path))
      if (target === null) continue
      const set = importers.get(target) ?? new Set<string>()
      set.add(file)
      importers.set(target, set)
    }
  }

  const reached = new Set<string>()
  const queue = [...WRAPPER_MODULES]

  while (queue.length > 0) {
    const current = queue.pop()
    if (current === undefined) break
    for (const importer of importers.get(current) ?? []) {
      if (reached.has(importer)) continue
      reached.add(importer)
      queue.push(importer)
    }
  }

  return new Set(
    [...reached].filter(
      (file) =>
        !WRAPPER_MODULES.includes(file) &&
        !LOCKED_CONTEXT_PREFIXES.some((prefix) => file.startsWith(prefix)),
    ),
  )
}

/** 新規利用と、移行済みなのに一覧へ残った項目を検出する。一覧は減らす方向にだけ動かす。 */
export function inspectWrapperMigration(
  dependents: ReadonlySet<string>,
  list: MigrationList,
  ownedWrapperSha256: string,
): WrapperViolation[] {
  const violations: WrapperViolation[] = []
  const listed = new Map<string, VerificationKind>()

  for (const kind of VERIFICATION_KINDS) {
    for (const file of list.dependents[kind]) {
      if (listed.has(file)) {
        violations.push({ file, reason: "移行一覧に重複して登録されています" })
      }
      listed.set(file, kind)
    }
  }

  for (const file of [...dependents].sort()) {
    if (!listed.has(file)) {
      violations.push({
        file,
        reason:
          "D1互換テストラッパーへの新しい依存です。業務判断は型付きRepository fake、SQLとHTTPはtests/d1のローカルD1で検証してください",
      })
    }
  }

  for (const [file] of [...listed].sort(([left], [right]) => left.localeCompare(right))) {
    if (!dependents.has(file)) {
      violations.push({
        file,
        reason:
          "D1互換テストラッパーへの依存が無くなりました。test-database-wrapper-migration.jsonから削除してください",
      })
    }
  }

  if (list.ownedWrapperSha256 !== ownedWrapperSha256) {
    violations.push({
      file: OWNED_WRAPPER,
      reason:
        "D1互換テストラッパーが変更されました。互換層は拡張せず、削減した場合だけownedWrapperSha256を更新してください",
    })
  }

  return violations
}

async function readSources(): Promise<Map<string, string>> {
  const sources = new Map<string, string>()

  for (const root of SCANNED_ROOTS) {
    for await (const file of new Glob("**/*.{ts,tsx}").scan(resolve(PROJECT_ROOT, root))) {
      const path = `${root}/${file}`
      sources.set(path, readFileSync(resolve(PROJECT_ROOT, path), "utf8"))
    }
  }

  return sources
}

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(PROJECT_ROOT, path)))
    .digest("hex")
}

function readMigrationList(): MigrationList {
  return migrationListSchema.parse(JSON.parse(readFileSync(MIGRATION_LIST_PATH, "utf8")))
}

/** 移行済みの項目だけを一覧から除く。新しい依存は追加しない。 */
function pruneMigrationList(dependents: ReadonlySet<string>): void {
  const list = readMigrationList()
  const pruned: MigrationList = {
    ownedWrapperSha256: list.ownedWrapperSha256,
    dependents: {
      business: list.dependents.business.filter((file) => dependents.has(file)),
      sql: list.dependents.sql.filter((file) => dependents.has(file)),
      http: list.dependents.http.filter((file) => dependents.has(file)),
      support: list.dependents.support.filter((file) => dependents.has(file)),
    },
  }
  writeFileSync(MIGRATION_LIST_PATH, `${JSON.stringify(pruned, null, 2)}\n`)
}

if (import.meta.main) {
  if (!existsSync(MIGRATION_LIST_PATH)) {
    console.error(`${relative(PROJECT_ROOT, MIGRATION_LIST_PATH)}: 移行一覧がありません`)
    process.exit(1)
  }

  const dependents = collectWrapperDependents(await readSources())

  if (process.argv.includes("--prune")) {
    pruneMigrationList(dependents)
  }

  const violations = inspectWrapperMigration(dependents, readMigrationList(), sha256(OWNED_WRAPPER))

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  console.log(`D1互換テストラッパーの移行対象: ${dependents.size}件`)
}
