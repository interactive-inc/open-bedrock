import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { Session } from "@/lib/auth/session"
import { canReadWorkStylesOf } from "@/contexts/work-style/interface/http/employee-work-styles/can-read-work-styles-of"
import { describe, expect, test } from "bun:test"
import { testAccountId } from "@tests/api/support/test-account-id"

function sessionWith(props: { employeeId: number; permissions: ReadonlyArray<string> }): Session {
  return new Session({
    accountId: testAccountId(1),
    employeeId: toWorkforceEmployeeId(props.employeeId),
    employmentStatus: "ACTIVE",
    permissions: new Set(props.permissions),
    roleKeys: [],
  })
}

describe("canReadWorkStylesOf", () => {
  test("self is always allowed", () => {
    expect(
      canReadWorkStylesOf(
        sessionWith({ employeeId: 5, permissions: [] }),
        toWorkforceEmployeeId(5),
      ),
    ).toBe(true)
  })

  test("work_style:read:all reads others", () => {
    expect(
      canReadWorkStylesOf(
        sessionWith({ employeeId: 1, permissions: ["work_style:read:all"] }),
        toWorkforceEmployeeId(5),
      ),
    ).toBe(true)
  })

  test("no permission cannot read others", () => {
    expect(
      canReadWorkStylesOf(
        sessionWith({ employeeId: 1, permissions: [] }),
        toWorkforceEmployeeId(5),
      ),
    ).toBe(false)
  })
})
