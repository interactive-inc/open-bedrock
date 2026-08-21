import { maxPointsPerThanks } from "@/contexts/thanks/domain/values/thanks-point-limit.catalog"

/**
 * 感謝に添えるポイントを検証する。0 はメッセージのみの感謝として許容する。
 * 負値・非整数・非数・上限超過は Error。null/undefined は 0 とみなす。
 */
export function toNonNegativePoints(raw: number | null | undefined): number | Error {
  if (raw === null || raw === undefined) {
    return 0
  }

  if (Number.isInteger(raw) === false) {
    return new Error("points must be an integer")
  }

  if (raw < 0) {
    return new Error("points must not be negative")
  }

  if (raw > maxPointsPerThanks) {
    return new Error("points exceeds the allowed maximum")
  }

  return raw
}
