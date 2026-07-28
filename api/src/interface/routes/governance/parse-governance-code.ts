import { z } from "zod"

const governanceCode = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/)

/**
 * URL パスの規程コードを検証する。不正なら null（呼び出し側は 404 に倒す）。
 */
export function parseGovernanceCode(value: string | undefined): string | null {
  const parsed = governanceCode.safeParse(value)
  return parsed.success ? parsed.data : null
}
