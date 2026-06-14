import { describe, expect, test } from "bun:test"
import { CorrectSalaryRevision } from "@/application/payroll/correct-salary-revision"
import { SalaryRevision } from "@/domain/payroll/salary-revision.entity"
import type { Context } from "@/env"
import { SalaryRevisionRepository } from "@/infrastructure/payroll/salary-revision-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"

type SeedProps = {
  context: Context
  effectiveDate: string
  previousBaseSalary: number
  newBaseSalary: number
}

async function seedRevision(props: SeedProps): Promise<number> {
  const created = await new SalaryRevisionRepository(props.context).create(
    SalaryRevision.create({
      employeeId: 5,
      effectiveDate: props.effectiveDate,
      previousBaseSalary: props.previousBaseSalary,
      newBaseSalary: props.newBaseSalary,
      reason: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CorrectSalaryRevision", () => {
  test("re-resolves previousBaseSalary when effectiveDate moves across revisions", async () => {
    const { context } = createTestContext()

    // 時系列: 2026-01 (300000→320000) → 2026-04 (320000→350000)
    await seedRevision({
      context,
      effectiveDate: "2026-01-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
    })

    const targetId = await seedRevision({
      context,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 320000,
      newBaseSalary: 350000,
    })

    // 2026-04 の改定を 2025-12 へ前倒し: 直前の改定がなくなるため前回基本給は 0 になる
    const corrected = await new CorrectSalaryRevision(context).run({
      viewerRole: "admin",
      salaryRevisionId: targetId,
      effectiveDate: "2025-12-01",
      newBaseSalary: 350000,
      reason: "backdate",
    })

    if (corrected instanceof Error || "reason" in corrected === false) {
      throw new Error("expected corrected revision")
    }

    if (corrected instanceof SalaryRevision === false) {
      throw new Error("expected SalaryRevision")
    }

    expect(corrected.effectiveDate).toBe("2025-12-01")
    expect(corrected.previousBaseSalary).toBe(0)
  })

  test("re-resolves previousBaseSalary from the prior revision after the move", async () => {
    const { context } = createTestContext()

    await seedRevision({
      context,
      effectiveDate: "2026-01-01",
      previousBaseSalary: 300000,
      newBaseSalary: 320000,
    })

    const targetId = await seedRevision({
      context,
      effectiveDate: "2025-06-01",
      previousBaseSalary: 0,
      newBaseSalary: 290000,
    })

    // 2025-06 の改定を 2026-03 へ後ろ倒し: 直前は 2026-01 の改定になる
    const corrected = await new CorrectSalaryRevision(context).run({
      viewerRole: "admin",
      salaryRevisionId: targetId,
      effectiveDate: "2026-03-01",
      newBaseSalary: 330000,
      reason: null,
    })

    if (corrected instanceof SalaryRevision === false) {
      throw new Error("expected SalaryRevision")
    }

    expect(corrected.previousBaseSalary).toBe(320000)
  })

  test("keeps previousBaseSalary when effectiveDate is unchanged", async () => {
    const { context } = createTestContext()

    const targetId = await seedRevision({
      context,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 320000,
      newBaseSalary: 350000,
    })

    const corrected = await new CorrectSalaryRevision(context).run({
      viewerRole: "admin",
      salaryRevisionId: targetId,
      effectiveDate: "2026-04-01",
      newBaseSalary: 360000,
      reason: "amount only",
    })

    if (corrected instanceof SalaryRevision === false) {
      throw new Error("expected SalaryRevision")
    }

    expect(corrected.previousBaseSalary).toBe(320000)
    expect(corrected.newBaseSalary).toBe(360000)
  })

  test("does not pick itself as the prior revision when moving forward", async () => {
    const { context } = createTestContext()

    const targetId = await seedRevision({
      context,
      effectiveDate: "2026-01-01",
      previousBaseSalary: 0,
      newBaseSalary: 320000,
    })

    // 自分しか改定がない状態で後ろ倒し: 自分自身を直前として拾えば 320000 になってしまう
    const corrected = await new CorrectSalaryRevision(context).run({
      viewerRole: "admin",
      salaryRevisionId: targetId,
      effectiveDate: "2026-06-01",
      newBaseSalary: 320000,
      reason: null,
    })

    if (corrected instanceof SalaryRevision === false) {
      throw new Error("expected SalaryRevision")
    }

    expect(corrected.previousBaseSalary).toBe(0)
  })

  test("member is forbidden", async () => {
    const { context } = createTestContext()

    const targetId = await seedRevision({
      context,
      effectiveDate: "2026-04-01",
      previousBaseSalary: 0,
      newBaseSalary: 350000,
    })

    const corrected = await new CorrectSalaryRevision(context).run({
      viewerRole: "member",
      salaryRevisionId: targetId,
      effectiveDate: "2026-04-01",
      newBaseSalary: 360000,
      reason: null,
    })

    if (corrected instanceof Error || corrected instanceof SalaryRevision) {
      throw new Error("expected forbidden")
    }

    expect(corrected.reason).toBe("forbidden")
  })
})
