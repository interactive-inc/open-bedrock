import { describe, expect, test } from "bun:test"
import { parseApplicationWorkflow } from "@/contexts/company/domain/organization/company-procedure-workflow"

function workflow(responsibilityType: string): unknown {
  return {
    version: 1,
    steps: [
      {
        key: "people_review",
        name: "People review",
        approvers: [
          {
            type: "responsibility",
            responsibility_type: responsibilityType,
            organization_unit_code: null,
          },
        ],
        approval_mode: "any",
        condition_mode: "all",
        conditions: [],
        due_days: null,
        escalation_approvers: [],
        rejection_behavior: "reject",
        allow_delegation: true,
      },
    ],
  }
}

describe("parseApplicationWorkflow", () => {
  test("accepts an explicit canonical Company responsibility", () => {
    expect(parseApplicationWorkflow(workflow("PEOPLE_OPERATIONS"))).not.toBeInstanceOf(Error)
  })

  test("rejects a responsibility that is not a stable uppercase token", () => {
    expect(parseApplicationWorkflow(workflow("people-operations"))).toBeInstanceOf(Error)
  })
})
