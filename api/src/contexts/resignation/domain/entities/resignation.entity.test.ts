import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import { describe, expect, test } from "bun:test"

describe("Resignation.create", () => {
  test("builds with UUID id and requested status", () => {
    const resignation = Resignation.create({
      employeeId: 1,
      resignationDate: "2026-09-30",
      lastWorkingDate: "2026-09-15",
      reason: "転職のため",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(resignation).toBeInstanceOf(Resignation)
    expect(resignation.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(resignation.status).toBe("requested")
    expect(resignation.employeeId).toBe(1)
    expect(resignation.resignationDate).toBe("2026-09-30")
    expect(resignation.lastWorkingDate).toBe("2026-09-15")
    expect(resignation.reason).toBe("転職のため")
  })
})

describe("Resignation.isModifiable", () => {
  test("returns true for requested status", () => {
    const resignation = Resignation.create({
      employeeId: 1,
      resignationDate: "2026-09-30",
      lastWorkingDate: null,
      reason: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(resignation.isModifiable).toBe(true)
  })

  test("returns false for completed status", () => {
    const resignation = new Resignation({
      id: crypto.randomUUID(),
      employeeId: 1,
      resignationDate: "2026-09-30",
      lastWorkingDate: null,
      reason: null,
      status: "completed",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(resignation.isModifiable).toBe(false)
  })
})

describe("Resignation.withDetails", () => {
  test("returns new instance with updated fields", () => {
    const resignation = Resignation.create({
      employeeId: 1,
      resignationDate: "2026-09-30",
      lastWorkingDate: null,
      reason: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    const updated = resignation.withDetails({
      resignationDate: "2026-10-31",
      lastWorkingDate: "2026-10-15",
      reason: "家庭の事情",
    })

    expect(updated).toBeInstanceOf(Resignation)
    expect(updated.resignationDate).toBe("2026-10-31")
    expect(updated.lastWorkingDate).toBe("2026-10-15")
    expect(updated.reason).toBe("家庭の事情")
    expect(updated.employeeId).toBe(1)
    expect(updated.status).toBe("requested")
  })
})
