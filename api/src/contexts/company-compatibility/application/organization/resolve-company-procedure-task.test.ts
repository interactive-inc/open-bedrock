import { resolveCompanyProcedureTask } from "@/contexts/company-compatibility/application/organization/resolve-company-procedure-task"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company-compatibility/domain/organization/company-procedure-decision-policy"
import type { Context } from "@/env"
import { expect, test } from "bun:test"

test("Company procedure without an authority workflow fails closed", async () => {
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: ["technical_admin"],
    workflow: null,
  })
  if (policy instanceof Error) throw policy

  const result = await resolveCompanyProcedureTask({
    c: {} as Context,
    policy,
    payload: {},
    applicant: {
      id: 1,
      code: "E001",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
    activatedAt: new Date("2026-01-01T00:00:00.000Z"),
    afterTaskKey: null,
  })

  expect(result).toEqual(new Error("Company procedure requires an explicit authority workflow"))
})
