import { UsageError } from "@/lib/errors"

// 文字列フラグを有限数へ変換する。未指定・非数値・NaN・Infinity は UsageError にする。
// Number() のみだと NaN がそのまま API に送られてしまうため、送信前にここで弾く。
export function toFiniteNumber(value: string | undefined, flagName: string): number {
  const parsed = Number(value)

  if (Number.isFinite(parsed) === false) {
    throw new UsageError(`${flagName} には数値を指定してください`)
  }

  return parsed
}
