import { canEvaluateAsManager, canViewOthers } from "@/lib/goal/goal-access"
import { describe, expect, test } from "bun:test"

describe("canViewOthers", () => {
  test("returns true for manager", () => {
    expect(canViewOthers("manager")).toBe(true)
  })

  test("returns true for hr", () => {
    expect(canViewOthers("hr")).toBe(true)
  })

  test("returns true for admin", () => {
    expect(canViewOthers("admin")).toBe(true)
  })

  test("returns false for member", () => {
    expect(canViewOthers("member")).toBe(false)
  })

  test("returns false for unknown role", () => {
    expect(canViewOthers("unknown")).toBe(false)
  })
})

describe("canEvaluateAsManager", () => {
  test("returns true for manager", () => {
    expect(canEvaluateAsManager("manager")).toBe(true)
  })

  test("returns true for hr", () => {
    expect(canEvaluateAsManager("hr")).toBe(true)
  })

  test("returns true for admin", () => {
    expect(canEvaluateAsManager("admin")).toBe(true)
  })

  test("returns false for member", () => {
    expect(canEvaluateAsManager("member")).toBe(false)
  })

  test("returns false for unknown role", () => {
    expect(canEvaluateAsManager("unknown")).toBe(false)
  })
})
