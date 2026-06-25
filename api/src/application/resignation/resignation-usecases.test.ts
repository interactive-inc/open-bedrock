import { describe, expect, test } from "bun:test"
import { CancelResignation } from "@/application/resignation/cancel-resignation"
import { CreateResignation } from "@/application/resignation/create-resignation"
import { GetResignation } from "@/application/resignation/get-resignation"
import { ListMyResignations } from "@/application/resignation/list-my-resignations"
import { UpdateResignation } from "@/application/resignation/update-resignation"
import { Resignation } from "@/domain/resignation/resignation.entity"
import type { Context } from "@/env"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedResignation(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateResignation(context).run({
    employeeId: employeeId,
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
    const { context } = createTestContext()

    const created = await new CreateResignation(context).run({
      employeeId: 2,
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

describe("GetResignation", () => {
  test("returns the resignation for its applicant", async () => {
    const { context } = createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new GetResignation(context).run({
      resignationId: resignationId,
      employeeId: 5,
    })

    expect(result).toBeInstanceOf(Resignation)
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new GetResignation(context).run({
      resignationId: resignationId,
      employeeId: 6,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })

  test("returns resignation_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetResignation(context).run({
      resignationId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      employeeId: 5,
    })

    expectApplicationError(result, NotFoundError, "resignation_not_found")
  })
})

describe("ListMyResignations", () => {
  test("returns only the applicant's resignations", async () => {
    const { context } = createTestContext()

    await seedResignation(context, 5)

    await seedResignation(context, 6)

    const result = await new ListMyResignations(context).run({
      employeeId: 5,
      limit: 20,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].employeeId).toBe(5)
  })
})

describe("UpdateResignation", () => {
  test("updates the details for the applicant", async () => {
    const { context } = createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new UpdateResignation(context).run({
      resignationId: resignationId,
      employeeId: 5,
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
    const { context } = createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new UpdateResignation(context).run({
      resignationId: resignationId,
      employeeId: 6,
      resignationDate: "2026-11-30",
      lastWorkingDate: null,
      reason: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })
})

describe("CancelResignation", () => {
  test("cancels the resignation for the applicant", async () => {
    const { context } = createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new CancelResignation(context).run({
      resignationId: resignationId,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const resignationId = await seedResignation(context, 5)

    const result = await new CancelResignation(context).run({
      resignationId: resignationId,
      employeeId: 6,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })
})
