import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const projectRoot = resolve(import.meta.dir, "..")
const manifestPath = resolve(projectRoot, "api-foundation.json")
const foundationFiles = [
  "scripts/check-api-foundation.ts",
  "src/api/api-route-module.ts",
  "src/api/read-http-exception-problem.ts",
  "src/api/test/api-route-module.test.ts",
  "src/api/test/to-negotiated-http-exception-response.test.ts",
  "src/api/to-negotiated-http-exception-response.ts",
] as const

type Manifest = Readonly<{
  version: number
  files: Readonly<Record<string, string>>
}>

function readManifest(): Manifest | Error {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return new Error("api-foundation.jsonはobjectである必要があります")
  }
  const version = Reflect.get(parsed, "version")
  const files = Reflect.get(parsed, "files")
  if (version !== 1 || typeof files !== "object" || files === null || Array.isArray(files)) {
    return new Error("api-foundation.jsonのversionまたはfilesが不正です")
  }

  const fileHashes: Record<string, string> = {}
  for (const entry of Object.entries(files)) {
    const file = entry[0]
    const hash = entry[1]
    if (typeof hash !== "string") {
      return new Error(`api-foundation.jsonのcontent hashが不正です: ${file}`)
    }
    fileHashes[file] = hash
  }

  return { version, files: fileHashes }
}

function sha256(file: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(projectRoot, file)))
    .digest("hex")
}

export function inspectApiFoundation(): ReadonlyArray<string> {
  const manifest = readManifest()
  if (manifest instanceof Error) return [manifest.message]
  const violations: string[] = []
  const expectedFiles = [...foundationFiles].sort()
  const declaredFiles = Object.keys(manifest.files).sort()

  if (JSON.stringify(declaredFiles) !== JSON.stringify(expectedFiles)) {
    violations.push("api-foundation.jsonのfile一覧が共通foundation契約と一致しません")
  }

  for (const file of foundationFiles) {
    const expectedHash = manifest.files[file]
    const actualHash = sha256(file)
    if (expectedHash !== actualHash) {
      violations.push(`${file}がapi-foundation.jsonのcontent hashと一致しません`)
    }
  }

  return violations
}

if (import.meta.main) {
  const violations = inspectApiFoundation()
  if (violations.length > 0) {
    for (const violation of violations) console.error(violation)
    process.exit(1)
  }

  console.log(`API foundationはmanifestと一致しています (${foundationFiles.length} files)`)
}
