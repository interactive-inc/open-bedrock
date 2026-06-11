import { toLeaveDays } from "@/domain/leave/to-leave-days"
import { describe, expect, test } from "bun:test"

describe("toLeaveDays", () => {
  test("same day returns 1", () => {
    expect(toLeaveDays("2026-07-01", "2026-07-01")).toBe(1)
  })

  test("multi-day range returns correct count", () => {
    expect(toLeaveDays("2026-07-01", "2026-07-05")).toBe(5)
  })

  test("two consecutive days returns 2", () => {
    expect(toLeaveDays("2026-07-01", "2026-07-02")).toBe(2)
  })

  test("end before start returns Error", () => {
    const leaveDays = toLeaveDays("2026-07-05", "2026-07-01")

    expect(leaveDays).toBeInstanceOf(Error)
  })

  test("invalid start date returns Error", () => {
    const leaveDays = toLeaveDays("not-a-date", "2026-07-01")

    expect(leaveDays).toBeInstanceOf(Error)
  })

  test("invalid end date returns Error", () => {
    const leaveDays = toLeaveDays("2026-07-01", "not-a-date")

    expect(leaveDays).toBeInstanceOf(Error)
  })
})
