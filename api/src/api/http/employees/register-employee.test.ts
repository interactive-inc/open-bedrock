import { RegisterEmployee } from "@/api/http/employees/register-employee"
import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { ApplicationError, ForbiddenError } from "@/lib/errors"
import type { Context } from "@/env"
import { createTestContext } from "@tests/api/support/create-test-context"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { beforeEach, describe, expect, test } from "bun:test"

/**
 * role割当ゲートの拒否文言。ゲート通過後の登録本体はIAM roleとorganization stateの
 * seedを要求するので、このtestはゲートの可否だけを文言で切り分ける。
 */
const ROLE_ASSIGNMENT_REJECTION = "このRoleを割り当てる権限がありません"

function isRoleAssignmentRejection(result: unknown): boolean {
  return result instanceof ApplicationError && result.message === ROLE_ASSIGNMENT_REJECTION
}

let context: Context

beforeEach(async () => {
  context = (await createTestContext()).context
})

/**
 * 登録に必要な権限は持つが、employee:assign_roleだけ持たない主体。
 * 4つのpreset roleでは再現できない組み合わせなので、custom roleとして直接組み立てる。
 */
function makeRegistrarWithoutRoleAssignment(): CompanySessionValue {
  const permissions = new Set(makeTestSession("root").permissions)

  permissions.delete("employee:assign_role")

  return new CompanySessionValue({
    accountId: zAccountId.parse("1"),
    employeeId: toWorkforceEmployeeId(1),
    employmentStatus: "ACTIVE",
    permissions: permissions,
    roleKeys: ["custom:registrar"],
  })
}

function withSession(session: CompanySessionValue): Context {
  return { ...context, var: { ...context.var, session: session } }
}

function makeInput(
  roleKey: "member" | "manager" | "hr" | "root",
): Parameters<RegisterEmployee["execute"]>[0] {
  return {
    action: {
      kind: "hire",
      employeeCode: "E900",
      employeeName: "Registration Test Employee",
      eventOn: restoreCalendarDate("2026-01-01"),
      departmentCode: null,
      positionTitle: null,
      managerEmployeeCode: null,
    },
    email: "you+e900@example.com",
    password: "password-for-test",
    roleKey: roleKey,
    idempotencyKey: `register-${roleKey}`,
    now: new Date("2026-01-01T00:00:00.000Z"),
  }
}

describe("RegisterEmployee role assignment authorization", () => {
  test("lets a registrar without employee:assign_role use the baseline role", async () => {
    const session = makeRegistrarWithoutRoleAssignment()

    expect(session.hasPermission("employee:assign_role")).toBe(false)

    const result = await new RegisterEmployee(withSession(session)).execute(makeInput("member"))

    expect(isRoleAssignmentRejection(result)).toBe(false)
  })

  test("rejects a registrar without employee:assign_role on a non-baseline role", async () => {
    const session = makeRegistrarWithoutRoleAssignment()

    const result = await new RegisterEmployee(withSession(session)).execute(makeInput("manager"))

    expect(result).toBeInstanceOf(ForbiddenError)
    expect(isRoleAssignmentRejection(result)).toBe(true)
  })

  test("lets an actor holding employee:assign_role use a non-baseline role", async () => {
    const session = makeTestSession("root")

    expect(session.hasPermission("employee:assign_role")).toBe(true)

    const result = await new RegisterEmployee(withSession(session)).execute(makeInput("manager"))

    expect(isRoleAssignmentRejection(result)).toBe(false)
  })
})
