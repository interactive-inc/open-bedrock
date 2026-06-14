import { CareerSheet } from "@/domain/career/career-sheet.entity"
import { describe, expect, test } from "bun:test"

describe("CareerSheet.create", () => {
  test("builds with given fields", () => {
    const sheet = CareerSheet.create({
      employeeId: 7,
      goalsText: "Become a tech lead",
      strengthsText: "Problem solving",
      updatedAt: "2026-06-01T09:00:00.000Z",
    })

    expect(sheet).toBeInstanceOf(CareerSheet)
    expect(sheet.employeeId).toBe(7)
    expect(sheet.goalsText).toBe("Become a tech lead")
    expect(sheet.strengthsText).toBe("Problem solving")
    expect(sheet.updatedAt).toBe("2026-06-01T09:00:00.000Z")
  })

  test("accepts null goals and strengths", () => {
    const sheet = CareerSheet.create({
      employeeId: 8,
      goalsText: null,
      strengthsText: null,
      updatedAt: "2026-06-02T09:00:00.000Z",
    })

    expect(sheet.goalsText).toBeNull()
    expect(sheet.strengthsText).toBeNull()
  })
})
