import { describe, expect, test } from "bun:test"
import { createUuidV7 } from "@/lib/crypto/create-uuid-v7"
import { uuidSchema } from "@/lib/validation/uuid.schema"

describe("createUuidV7", () => {
  test("小文字の 8-4-4-4-12 で version 7 と variant 0b10 を持つ", () => {
    expect(createUuidV7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test("uuidSchema が受け入れる", () => {
    expect(uuidSchema.safeParse(createUuidV7()).success).toBe(true)
  })

  test("先頭48bitに現在時刻を持つ", () => {
    const before = Date.now()
    const timestamp = Number.parseInt(createUuidV7().replaceAll("-", "").slice(0, 12), 16)

    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(Date.now())
  })

  test("同一ミリ秒でも重複せず単調増加する", () => {
    const values = Array.from({ length: 10_000 }, createUuidV7)

    expect(new Set(values).size).toBe(values.length)
    expect(values).toEqual(values.toSorted())
  })

  test("時刻が巻き戻っても重複せず単調増加する", () => {
    const originalNow = Date.now
    const frozen = originalNow()

    try {
      // 同一ミリ秒でカウンタを使い切らせてから時刻を巻き戻す。
      Date.now = () => frozen
      const beforeRollback = Array.from({ length: 5_000 }, createUuidV7)
      Date.now = () => frozen - 10_000
      const afterRollback = Array.from({ length: 5_000 }, createUuidV7)
      const values = [...beforeRollback, ...afterRollback]

      expect(new Set(values).size).toBe(values.length)
      expect(values).toEqual(values.toSorted())
      expect(values.every((value) => value[14] === "7")).toBe(true)
    } finally {
      Date.now = originalNow
    }
  })
})
