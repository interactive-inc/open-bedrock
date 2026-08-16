import { CompanyCalendarDay } from "@/contexts/company-calendar/domain/calendar/company-calendar-day.entity"
import { describe, expect, test } from "bun:test"

describe("CompanyCalendarDay.create", () => {
  test("builds an unsaved holiday with null id", () => {
    const day = CompanyCalendarDay.create({
      calendarDate: "2026-01-01",
      kind: "holiday",
      name: "元日",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(day).toBeInstanceOf(CompanyCalendarDay)
    expect(day.id).toBe(null)
    expect(day.calendarDate).toBe("2026-01-01")
    expect(day.kind).toBe("holiday")
    expect(day.name).toBe("元日")
  })

  test("allows a workday with a null name", () => {
    const day = CompanyCalendarDay.create({
      calendarDate: "2026-01-04",
      kind: "workday",
      name: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(day.kind).toBe("workday")
    expect(day.name).toBe(null)
  })

  test("rejects an unknown kind", () => {
    expect(() =>
      CompanyCalendarDay.create({
        calendarDate: "2026-01-01",
        // @ts-expect-error 不正な kind を弾くことを確認する
        kind: "weekend",
        name: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow()
  })
})
