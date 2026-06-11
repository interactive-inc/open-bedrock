import { canManageSurveys } from "@/domain/survey/can-manage-surveys"
import { describe, expect, test } from "bun:test"

describe("canManageSurveys", () => {
  test("manager can manage", () => {
    expect(canManageSurveys("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageSurveys("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageSurveys("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageSurveys("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageSurveys("viewer")).toBe(false)
  })
})
