import { canSubmitForm } from "@/domain/review/can-submit-form"
import { describe, expect, test } from "bun:test"

describe("canSubmitForm", () => {
  test("same reviewer and viewer returns true", () => {
    expect(canSubmitForm({ reviewerEmployeeId: 5, viewerEmployeeId: 5 })).toBe(true)
  })

  test("different reviewer and viewer returns false", () => {
    expect(canSubmitForm({ reviewerEmployeeId: 5, viewerEmployeeId: 6 })).toBe(false)
  })
})
