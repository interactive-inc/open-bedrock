import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateResignation } from "@/contexts/resignation/application/create-resignation"
import { UpdateResignation } from "@/contexts/resignation/application/update-resignation"
import { Resignation } from "@/contexts/resignation/domain/entities/resignation.entity"
import type { Context } from "@/env"
import { ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { createTestContext } from "@tests/api/support/create-test-context"

async function seedResignation(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateResignation(context).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    resignationDate: "2026-09-30",
    lastWorkingDate: "2026-09-20",
    reason: "Career change",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateResignation", () => {
  test("creates a resignation with status requested", async () => {
    const { context } = await createTestContext()

    const created = await new CreateResignation(context).run({
      employeeId: toWorkforceEmployeeId(2),
      resignationDate: "2026-10-31",
      lastWorkingDate: null,
      reason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(Resignation)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.lastWorkingDate).toBe(null)
    expect(created.reason).toBe(null)
  })
})

describe("GetResignation", () => {})

describe("ListMyResignations", () => {})

describe("UpdateResignation", () => {
  test("updates the details for the applicant", async () => {
    const { context } = await createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new UpdateResignation(context).run({
      resignationId: resignationId,
      employeeId: toWorkforceEmployeeId(5),
      resignationDate: "2026-11-30",
      lastWorkingDate: "2026-11-20",
      reason: "Relocation",
    })

    expect(result).toBeInstanceOf(Resignation)

    if (result instanceof Error || result instanceof Resignation === false) {
      throw new Error("update failed")
    }

    expect(result.resignationDate).toBe("2026-11-30")
    expect(result.reason).toBe("Relocation")
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = await createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new UpdateResignation(context).run({
      resignationId: resignationId,
      employeeId: toWorkforceEmployeeId(6),
      resignationDate: "2026-11-30",
      lastWorkingDate: null,
      reason: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })
})

describe("CancelResignation", () => {})
