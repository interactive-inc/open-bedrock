import { Session } from "@/lib/auth/session"
import { canReadWorkStylesOf } from "@/interface/routes/employee-work-styles/can-read-work-styles-of"
import { describe, expect, test } from "bun:test"

function sessionWith(props: { employeeId: number; permissions: ReadonlyArray<string> }): Session {
  return new Session({
    accountId: 1,
    employeeId: props.employeeId,
    employeeStatus: "active",
    permissions: new Set(props.permissions),
    roleKeys: [],
  })
}

describe("canReadWorkStylesOf", () => {
  test("self is always allowed", () => {
    expect(canReadWorkStylesOf(sessionWith({ employeeId: 5, permissions: [] }), 5)).toBe(true)
  })

  test("work_style:read:all reads others", () => {
    expect(
      canReadWorkStylesOf(sessionWith({ employeeId: 1, permissions: ["work_style:read:all"] }), 5),
    ).toBe(true)
  })

  test("no permission cannot read others", () => {
    expect(canReadWorkStylesOf(sessionWith({ employeeId: 1, permissions: [] }), 5)).toBe(false)
  })
})
