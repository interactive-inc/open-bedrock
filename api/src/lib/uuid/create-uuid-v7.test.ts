import { createUuidV7 } from "@/lib/uuid/create-uuid-v7"
import { uuidCheckPredicate, uuidSchema } from "@/lib/uuid/uuid.schema"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"

describe("createUuidV7", () => {
  test("sets the version nibble to 7", () => {
    expect(createUuidV7()[14]).toBe("7")
  })

  test("sets the RFC 9562 variant bits to 0b10", () => {
    expect(["8", "9", "a", "b"]).toContain(createUuidV7()[19] as string)
  })

  test("formats as canonical lowercase 8-4-4-4-12", () => {
    expect(createUuidV7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  test("encodes the current time in the leading 48 bits", () => {
    const before = Date.now()
    const timestamp = Number.parseInt(createUuidV7().replaceAll("-", "").slice(0, 12), 16)

    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(Date.now())
  })

  test("never repeats a value", () => {
    const values = Array.from({ length: 10_000 }, createUuidV7)

    expect(new Set(values).size).toBe(values.length)
  })

  test("increases monotonically even within the same millisecond", () => {
    const values = Array.from({ length: 10_000 }, createUuidV7)

    expect(values).toEqual([...values].sort())
  })

  test("時刻が巻き戻っても単調増加と一意性を保つ", () => {
    const originalNow = Date.now
    const frozen = originalNow()

    try {
      // 同一ミリ秒でカウンタを使い切らせ、そのうえで時刻を巻き戻す。
      // カウンタが 12bit を溢れて周回すると同じ値を二度返してしまう。
      Date.now = () => frozen
      const beforeRollback = Array.from({ length: 5_000 }, createUuidV7)

      Date.now = () => frozen - 10_000
      const afterRollback = Array.from({ length: 5_000 }, createUuidV7)

      const values = [...beforeRollback, ...afterRollback]

      expect(new Set(values).size).toBe(values.length)
      expect(values).toEqual([...values].sort())
      expect(values.every((value) => value[14] === "7")).toBe(true)
    } finally {
      Date.now = originalNow
    }
  })
})

describe("uuidSchema と uuidCheckPredicate の一致", () => {
  const accepted = [
    ...Array.from({ length: 1_000 }, createUuidV7),
    ...Array.from({ length: 100 }, () => crypto.randomUUID()),
  ]
  const rejected = [
    "1",
    "organization:default",
    "employment:seed-employment-1",
    "00000000-0000-0000-0000-000000000000",
    "0195E2A1-4C3F-7ABC-8DEF-0123456789AB",
    "0195e2a1-4c3f-7abc-8def-0123456789a",
    "0195e2a1-4c3f-7abc-8def-0123456789abc",
    "0195e2a1_4c3f_7abc_8def_0123456789ab",
    "",
  ]

  /**
   * SQL 側の CHECK 制約を実際の SQLite で評価する。
   *
   * 主キーの一意制約が混ざると、同じ値が二度現れただけで「CHECK に落ちた」ように
   * 見えてしまう。CHECK だけを見たいので毎回入れ直す。
   */
  function sqlAccepts(values: readonly string[]): boolean[] {
    const database = new Database(":memory:")
    database.run(`CREATE TABLE probe (id TEXT, CHECK (${uuidCheckPredicate("id")}))`)

    return values.map((value) => {
      try {
        database.run("DELETE FROM probe")
        database.run("INSERT INTO probe (id) VALUES (?)", [value])
        return true
      } catch {
        return false
      }
    })
  }

  test("生成した UUID は Zod と SQL の両方が受け入れる", () => {
    expect(accepted.every((value) => uuidSchema.safeParse(value).success)).toBe(true)
    expect(sqlAccepts(accepted).every(Boolean)).toBe(true)
  })

  test("UUID でない値は Zod と SQL の両方が拒否する", () => {
    expect(rejected.some((value) => uuidSchema.safeParse(value).success)).toBe(false)
    expect(sqlAccepts(rejected).some(Boolean)).toBe(false)
  })

  /**
   * Zod と SQL が「同じ集合を表す」ことを、両方に同じ入力を通して突き合わせる。
   *
   * 桁と文字種だけを一致させても version / variant の扱いがずれると、DB には入るが
   * API の入口で弾かれる ID が生まれる。以後この 2 つが乖離したらここで落ちる。
   */
  test("Zod と SQL の判定はあらゆる形の入力で一致する", () => {
    const probes = [
      ...Array.from({ length: 200 }, createUuidV7),
      ...Array.from({ length: 50 }, () => crypto.randomUUID()),
      // version nibble (13 文字目) の全パターン
      ...Array.from(
        { length: 16 },
        (_, index) => `abcdefab-cdef-${index.toString(16)}abc-8def-abcdefabcdef`,
      ),
      // variant nibble (17 文字目) の全パターン
      ...Array.from(
        { length: 16 },
        (_, index) => `abcdefab-cdef-4abc-${index.toString(16)}def-abcdefabcdef`,
      ),
      "11111111-1111-1111-1111-111111111111",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      "0195E2A1-4C3F-7ABC-8DEF-0123456789AB",
      "0195e2a1-4c3f-7abc-8def-0123456789a",
      "0195e2a1-4c3f-7abc-8def-0123456789abc",
      "0195e2a1_4c3f_7abc_8def_0123456789ab",
      "0195e2a1-4c3f-7abc-8def-0123456789ag",
      // 36 文字だが区切りが 5 個ある。桁数だけでは弾けない形。
      "0190000--0000-7000-8000-000000000a01",
      "01900000-0000-7000-8000-00000000-a01",
      "-1900000-0000-7000-8000-000000000a01",
      "organization:default",
      "employment:seed-employment-1",
      "password:1",
      "1",
      "",
    ]
    const sqlResults = sqlAccepts(probes)
    const disagreements = probes.filter(
      (value, index) => uuidSchema.safeParse(value).success !== sqlResults[index],
    )

    expect(disagreements).toEqual([])
  })
})
