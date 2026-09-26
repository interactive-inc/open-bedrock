import { createHash } from "node:crypto"
import { uuidSchema } from "@/lib/validation/uuid.schema"

/**
 * テストの Account・社員・関連する識別子を UUID にそろえる。
 *
 * 数字の ID は seed と同じ規則（Account は `01900061-…`、社員は `01900062-…` に番号の 16 進）で写し、
 * それ以外の文字列は種類と値から決まる UUID にする。UUID はそのまま返す。
 */
function literalUuid(value: string): string {
  const hash = createHash("md5").update(`f-identity:${value}`).digest("hex")
  const variant = "89ab"[Number.parseInt(hash.charAt(16), 16) & 3]
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function serial(prefix: string, value: string): string {
  return `${prefix}-0000-7000-8000-${Number(value).toString(16).padStart(12, "0")}`
}

export function testAccountId(value: number | string): string {
  const text = String(value)
  if (uuidSchema.safeParse(text).success) return text
  return /^\d+$/u.test(text) ? serial("01900061", text) : literalUuid(text)
}

export function testEmployeeId(value: number | string): string {
  const text = String(value)
  if (uuidSchema.safeParse(text).success) return text
  return /^\d+$/u.test(text) ? serial("01900062", text) : literalUuid(text)
}

/** 社員などから導く識別子（雇用、発令、期間、資源）。同じ入力には同じ UUID を返す。 */
export function testDerivedId(kind: string, ...parts: ReadonlyArray<number | string>): string {
  return literalUuid(`${kind}:${parts.join(":")}`)
}
