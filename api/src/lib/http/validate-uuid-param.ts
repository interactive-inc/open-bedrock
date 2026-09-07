import { NotFoundError } from "@/lib/http/errors"
import { uuidSchema } from "@/lib/uuid/uuid.schema"

/**
 * パスパラメータを UUID として検証する (Issue #1311)。
 *
 * `validateIntParam` の UUID 版。UUID でない値は「対象リソースが存在しない」と等価なので
 * NotFoundError を返す。存在しない ID の形と存在しない行を区別して 400 を返すと、
 * ID の形だけで実在を推測できてしまう。
 */
export function validateUuidParam(raw: string | undefined, label: string): string {
  const parsed = uuidSchema.safeParse(raw ?? "")

  if (parsed.success === false) {
    throw new NotFoundError(`${label} not found`)
  }

  return parsed.data
}
