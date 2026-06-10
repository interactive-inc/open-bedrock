import { NotFoundError } from "@/interface/lib/errors"

// RFC 4122 v4 UUID（crypto.randomUUID() が生成する形式）。ハイフン区切り・小文字。
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// パスパラメータが UUID 形式でなければ 404 を投げる。
// 不正値は「対象リソースが存在しない」と等価なので NotFoundError を返す。
export function validateUuidParam(raw: string | undefined, label: string): string {
  const value = raw ?? ""

  if (UUID_RE.test(value) === false) {
    throw new NotFoundError(`${label} not found`)
  }

  return value
}
