import { ShiftAssignment } from "@/domain/shift/shift-assignment"
import { describe, expect, test } from "bun:test"

describe("ShiftAssignment.create", () => {
  test("builds with null id and null publishedAt", () => {
    const assignment = ShiftAssignment.create({
      employeeId: 5,
      patternId: 1,
      date: "2026-06-15",
      note: "Holiday coverage",
    })

    expect(assignment).toBeInstanceOf(ShiftAssignment)
    expect(assignment.id).toBeNull()
    expect(assignment.publishedAt).toBeNull()
    expect(assignment.employeeId).toBe(5)
    expect(assignment.patternId).toBe(1)
    expect(assignment.date).toBe("2026-06-15")
    expect(assignment.note).toBe("Holiday coverage")
  })
})

describe("ShiftAssignment.isModifiable", () => {
  test("true when unpublished", () => {
    const assignment = ShiftAssignment.create({
      employeeId: 5,
      patternId: 1,
      date: "2026-06-15",
      note: null,
    })

    expect(assignment.isModifiable).toBe(true)
  })

  test("false when published", () => {
    const assignment = ShiftAssignment.create({
      employeeId: 5,
      patternId: 1,
      date: "2026-06-15",
      note: null,
    })

    const published = assignment.withPublished("2026-06-10T12:00:00.000Z")

    expect(published.isModifiable).toBe(false)
  })
})

describe("ShiftAssignment.withPublished", () => {
  test("returns new with publishedAt set", () => {
    const assignment = ShiftAssignment.create({
      employeeId: 5,
      patternId: 1,
      date: "2026-06-15",
      note: null,
    })

    const published = assignment.withPublished("2026-06-10T12:00:00.000Z")

    expect(published).toBeInstanceOf(ShiftAssignment)
    expect(published.publishedAt).toBe("2026-06-10T12:00:00.000Z")
    expect(published.employeeId).toBe(5)
    expect(published.date).toBe("2026-06-15")
  })
})

describe("ShiftAssignment.withDetails", () => {
  test("returns new with changed fields", () => {
    const assignment = ShiftAssignment.create({
      employeeId: 5,
      patternId: 1,
      date: "2026-06-15",
      note: "Original note",
    })

    const updated = assignment.withDetails({
      patternId: 2,
      date: "2026-06-20",
      note: "Updated note",
    })

    expect(updated).toBeInstanceOf(ShiftAssignment)
    expect(updated.patternId).toBe(2)
    expect(updated.date).toBe("2026-06-20")
    expect(updated.note).toBe("Updated note")
    expect(updated.employeeId).toBe(5)
    expect(updated.publishedAt).toBeNull()
  })
})
