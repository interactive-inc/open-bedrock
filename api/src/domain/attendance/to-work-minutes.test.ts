import { toWorkMinutes } from "@/domain/attendance/to-work-minutes"
import { describe, expect, test } from "bun:test"

describe("toWorkMinutes", () => {
  test("returns the difference in minutes between clockIn and clockOut", () => {
    const result = toWorkMinutes({
      clockInAt: "2026-06-10T09:00:00.000Z",
      clockOutAt: "2026-06-10T17:30:00.000Z",
    })

    expect(result).toBe(510) // 8h30m = 510 min
  })

  test("returns 0 when clockIn and clockOut are the same", () => {
    const result = toWorkMinutes({
      clockInAt: "2026-06-10T09:00:00.000Z",
      clockOutAt: "2026-06-10T09:00:00.000Z",
    })

    expect(result).toBe(0)
  })

  test("returns an Error when clockOutAt is before clockInAt", () => {
    const result = toWorkMinutes({
      clockInAt: "2026-06-10T17:00:00.000Z",
      clockOutAt: "2026-06-10T09:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe("clockOutAt is before clockInAt")
  })

  test("returns an Error when clockInAt is invalid", () => {
    const result = toWorkMinutes({
      clockInAt: "not-a-date",
      clockOutAt: "2026-06-10T17:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain("invalid clockInAt")
  })

  test("returns an Error when clockOutAt is invalid", () => {
    const result = toWorkMinutes({
      clockInAt: "2026-06-10T09:00:00.000Z",
      clockOutAt: "not-a-date",
    })

    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain("invalid clockOutAt")
  })
})
