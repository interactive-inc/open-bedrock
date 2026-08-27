import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { canSubmitForm } from "@/contexts/performance-review/domain/policies/review-form-submission.policy"
import { describe, expect, test } from "bun:test"

describe("canSubmitForm", () => {
  test("same reviewer and viewer returns true", () => {
    expect(
      canSubmitForm({
        reviewerEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(5),
      }),
    ).toBe(true)
  })

  test("different reviewer and viewer returns false", () => {
    expect(
      canSubmitForm({
        reviewerEmployeeId: toWorkforceEmployeeId(5),
        viewerEmployeeId: toWorkforceEmployeeId(6),
      }),
    ).toBe(false)
  })
})
