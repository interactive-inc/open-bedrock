import { Glob } from "bun"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const MANIFEST_PATH = resolve(PROJECT_ROOT, "company-context.manifest.json")
const LOCK_PATH = resolve(PROJECT_ROOT, "company-context.lock.json")

const companySourceManifestSchema = z.strictObject({
  version: z.literal(2),
  coverage: z.literal("shared-company-core"),
  sharedSourcePaths: z.array(z.string().min(1)).min(1),
  implementedCapabilities: z.array(z.string().min(1)),
  targetCapabilities: z.array(z.string().min(1)),
})

const companySourceLockSchema = z.strictObject({
  version: z.literal(1),
  files: z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{64}$/)),
})

function hashFile(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(PROJECT_ROOT, relativePath)))
    .digest("hex")
}

function readManifest() {
  return companySourceManifestSchema.parse(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")))
}

export async function collectSharedCompanySourceHashes(): Promise<ReadonlyMap<string, string>> {
  const manifest = readManifest()
  const sharedSourcePaths = manifest.sharedSourcePaths.toSorted()
  if (
    sharedSourcePaths.some(
      (relativePath, index) => relativePath !== manifest.sharedSourcePaths[index],
    ) ||
    new Set(sharedSourcePaths).size !== sharedSourcePaths.length
  ) {
    throw new Error(
      "company-context.manifest.json の sharedSourcePaths は重複なくpath昇順で宣言してください",
    )
  }

  for (const relativePath of sharedSourcePaths) {
    const matches = Array.from(
      new Glob(relativePath).scanSync({ cwd: PROJECT_ROOT, onlyFiles: true }),
    )
    if (matches.length !== 1 || matches[0] !== relativePath) {
      throw new Error(`Company共通sourceが存在しません: ${relativePath}`)
    }
  }

  const paths = ["company-context.manifest.json", ...sharedSourcePaths]

  return new Map(
    [...new Set(paths)].toSorted().map((relativePath) => [relativePath, hashFile(relativePath)]),
  )
}

export async function writeSharedCompanySourceLock(): Promise<void> {
  const actual = await collectSharedCompanySourceHashes()
  writeFileSync(
    LOCK_PATH,
    `${JSON.stringify({ version: 1, files: Object.fromEntries(actual) }, null, 2)}\n`,
  )
}

export async function checkSharedCompanySource(): Promise<string[]> {
  const lock = companySourceLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, "utf8")))
  const expectedPaths = Object.keys(lock.files)
  const actual = await collectSharedCompanySourceHashes()
  const violations: string[] = []

  if (
    expectedPaths.some((relativePath, index) => relativePath !== expectedPaths.toSorted()[index])
  ) {
    violations.push("company-context.lock.json の files はpath昇順で宣言してください")
  }

  for (const [relativePath, actualHash] of actual) {
    const expectedHash = lock.files[relativePath]
    if (expectedHash === undefined) {
      violations.push(`Company共通sourceがlockにありません: ${relativePath}`)
    } else if (expectedHash !== actualHash) {
      violations.push(`Company共通sourceのhashがlockと一致しません: ${relativePath}`)
    }
  }

  for (const relativePath of expectedPaths) {
    if (!actual.has(relativePath)) {
      violations.push(`lockだけに存在するCompany共通sourceです: ${relativePath}`)
    }
  }

  return violations
}

if (import.meta.main) {
  if (process.argv.includes("--write")) {
    await writeSharedCompanySourceLock()
    console.log("Company共通source lockを更新しました")
  } else {
    const violations = await checkSharedCompanySource()
    if (violations.length > 0) {
      console.error(violations.join("\n"))
      process.exit(1)
    }
    console.log("Company共通sourceはlockと一致しています")
  }
}
