import { z } from "zod"

const version = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)

/**
 * URL パスの規程バージョン（semver 風）を検証する。不正なら null（呼び出し側は 404 に倒す）。
 */
export function parseGovernanceVersion(value: string | undefined): string | null {
  const parsed = version.safeParse(value)
  return parsed.success ? parsed.data : null
}
