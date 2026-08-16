import { ShiftPattern } from "@/contexts/shift/domain/shift-pattern.entity"
import { describe, expect, test } from "bun:test"

describe("ShiftPattern.create", () => {
  test("builds with null id", () => {
    const pattern = ShiftPattern.create({
      code: "MORNING",
      name: "Morning shift",
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 60,
    })

    expect(pattern).toBeInstanceOf(ShiftPattern)
    expect(pattern.id).toBe(null)
    expect(pattern.code).toBe("MORNING")
    expect(pattern.breakMinutes).toBe(60)
  })
})

describe("ShiftPattern.withDetails", () => {
  test("returns new with changed fields", () => {
    const pattern = ShiftPattern.create({
      code: "MORNING",
      name: "Morning shift",
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 60,
    })

    const updated = pattern.withDetails({
      code: "EVENING",
      name: "Evening shift",
      startTime: "17:00",
      endTime: "01:00",
      breakMinutes: 45,
    })

    expect(updated.code).toBe("EVENING")
    expect(updated.name).toBe("Evening shift")
    expect(updated.breakMinutes).toBe(45)
  })
})
