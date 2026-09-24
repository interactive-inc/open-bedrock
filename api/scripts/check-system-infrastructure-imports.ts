import { Glob } from "bun"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import process from "node:process"
import ts from "typescript"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const BASELINE_PATH = resolve(PROJECT_ROOT, "system-infrastructure-import-baseline.json")

/** Systemのinfrastructureを直接読んではならない製品側の範囲。 */
const SCANNED_ROOTS = ["src/api", "src/contexts"] as const

/** 共有contextはそれぞれのmanifestとlockが依存方向を固定するため対象外にする。 */
const SHARED_CONTEXT_PREFIXES = ["src/contexts/system/", "src/contexts/company/"] as const

const SYSTEM_INFRASTRUCTURE_PREFIX = "src/contexts/system/infrastructure/"

const ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["@system/", "src/contexts/system/"],
  ["@tests/", "tests/"],
  ["@/", "src/"],
]

const baselineSchema = z.strictObject({
  imports: z.record(z.string().min(1), z.array(z.string().min(1))),
})

export type ImportBaseline = z.infer<typeof baselineSchema>

export type ImportViolation = Readonly<{
  file: string
  reason: string
}>

/** import指定子をproject相対pathへ正規化する。拡張子は補わず、外部packageはnullを返す。 */
export function normalizeImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return relative(PROJECT_ROOT, resolve(PROJECT_ROOT, dirname(fromFile), specifier))
  }
  for (const [alias, target] of ALIASES) {
    if (specifier.startsWith(alias)) return `${target}${specifier.slice(alias.length)}`
  }
  return null
}

function isScanned(file: string): boolean {
  return !SHARED_CONTEXT_PREFIXES.some((prefix) => file.startsWith(prefix))
}

/** 製品側fileごとに、import先のSystem infrastructure moduleを重複なく昇順で返す。 */
export function collectSystemInfrastructureImports(
  sources: ReadonlyMap<string, string>,
): Map<string, string[]> {
  const imports = new Map<string, string[]>()

  for (const [file, text] of sources) {
    if (!isScanned(file)) continue
    const targets = new Set<string>()
    for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
      const target = normalizeImport(file, imported.fileName)
      if (target?.startsWith(SYSTEM_INFRASTRUCTURE_PREFIX)) targets.add(target)
    }
    if (targets.size > 0) imports.set(file, [...targets].sort())
  }

  return imports
}

/** 基準線に無い依存と、解消済みなのに基準線へ残った依存を検出する。基準線は減らす方向にだけ動かす。 */
export function inspectSystemInfrastructureImports(
  current: ReadonlyMap<string, ReadonlyArray<string>>,
  baseline: ImportBaseline,
): ImportViolation[] {
  const violations: ImportViolation[] = []
  const files = new Set([...current.keys(), ...Object.keys(baseline.imports)])

  for (const file of [...files].sort()) {
    const allowed = new Set(baseline.imports[file] ?? [])
    const actual = new Set(current.get(file) ?? [])

    for (const target of [...actual].sort()) {
      if (allowed.has(target)) continue
      violations.push({
        file,
        reason: `System infrastructureへの新しい依存です（${target}）。Systemのinterface operation、application、またはproduct側adapterを経由してください`,
      })
    }

    for (const target of [...allowed].sort()) {
      if (actual.has(target)) continue
      violations.push({
        file,
        reason: `System infrastructureへの依存が無くなりました（${target}）。bun run lint:system-infrastructure-imports -- --prune で基準線から削除してください`,
      })
    }
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

function readBaseline(): ImportBaseline {
  return baselineSchema.parse(JSON.parse(readFileSync(BASELINE_PATH, "utf8")))
}

function writeBaseline(baseline: ImportBaseline): void {
  const sorted = Object.fromEntries(
    Object.entries(baseline.imports)
      .filter(([, targets]) => targets.length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ imports: sorted }, null, 2)}\n`)
}

/** 解消済みの依存だけを基準線から除く。新しい依存は追加しない。 */
function pruneBaseline(current: ReadonlyMap<string, ReadonlyArray<string>>): void {
  const baseline = readBaseline()
  const imports: Record<string, string[]> = {}
  for (const [file, targets] of Object.entries(baseline.imports)) {
    const actual = new Set(current.get(file) ?? [])
    imports[file] = targets.filter((target) => actual.has(target))
  }
  writeBaseline({ imports })
}

if (import.meta.main) {
  const current = collectSystemInfrastructureImports(await readSources())

  if (process.argv.includes("--init")) {
    if (existsSync(BASELINE_PATH)) {
      console.error(`${relative(PROJECT_ROOT, BASELINE_PATH)}: 基準線は既に存在します`)
      process.exit(1)
    }
    writeBaseline({ imports: Object.fromEntries(current) })
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`${relative(PROJECT_ROOT, BASELINE_PATH)}: 基準線がありません`)
    process.exit(1)
  }

  if (process.argv.includes("--prune")) pruneBaseline(current)

  const violations = inspectSystemInfrastructureImports(current, readBaseline())

  if (violations.length > 0) {
    for (const violation of violations) console.error(`${violation.file}: ${violation.reason}`)
    process.exit(1)
  }

  const total = [...current.values()].reduce((sum, targets) => sum + targets.length, 0)
  console.log(`System infrastructureへの既存依存: ${current.size}ファイル、${total}件`)
}
