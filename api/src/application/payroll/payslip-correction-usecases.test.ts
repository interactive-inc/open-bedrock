import { describe, expect, test } from "bun:test"
import { CancelPayslip } from "@/application/payroll/cancel-payslip"
import { CorrectPayslip } from "@/application/payroll/correct-payslip"
import { Payslip } from "@/domain/payroll/payslip.entity"
import type { Context } from "@/env"
import { PayslipRepository } from "@/infrastructure/payroll/payslip-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedPayslip(context: Context): Promise<number> {
  const created = await new PayslipRepository(context).create(
    Payslip.create({
      employeeId: 5,
      period: "2026-04",
      baseSalary: 300000,
      allowances: 20000,
      deductions: 45000,
      netPay: 275000,
      issuedAt: "2026-04-25T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed failed")
  }

  return created.id
}

async function seedDraftPayslip(context: Context): Promise<number> {
  const created = await new PayslipRepository(context).create(
    new Payslip({
      id: null,
      employeeId: 5,
      period: "2026-05",
      baseSalary: 300000,
      allowances: 20000,
      deductions: 45000,
      netPay: 275000,
      issuedAt: null,
      status: "draft",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CorrectPayslip", () => {
  test("privileged role corrects period and amounts with the given values", async () => {
    const { context } = createTestContext()

    const payslipId = await seedPayslip(context)

    const corrected = await new CorrectPayslip(context).run({
      viewerRole: "admin",
      payslipId: payslipId,
      period: "2026-04",
      baseSalary: 310000,
      allowances: 25000,
      deductions: 50000,
      netPay: 285000,
    })

    expect(corrected).toBeInstanceOf(Payslip)

    if (corrected instanceof Payslip === false) {
      throw new Error("expected a payslip")
    }

    expect(corrected.baseSalary).toBe(310000)
    expect(corrected.netPay).toBe(285000)
  })

  test("returns forbidden for a non-privileged role", async () => {
    const { context } = createTestContext()

    const payslipId = await seedPayslip(context)

    const result = await new CorrectPayslip(context).run({
      viewerRole: "member",
      payslipId: payslipId,
      period: "2026-04",
      baseSalary: 310000,
      allowances: 25000,
      deductions: 50000,
      netPay: 285000,
    })

    expect(result instanceof Payslip).toBe(false)

    if (result instanceof Payslip === false && result instanceof Error === false) {
      expect(result.reason).toBe("forbidden")
    }
  })

  test("returns payslip_not_found for a missing payslip", async () => {
    const { context } = createTestContext()

    const result = await new CorrectPayslip(context).run({
      viewerRole: "admin",
      payslipId: 9999,
      period: "2026-04",
      baseSalary: 310000,
      allowances: 25000,
      deductions: 50000,
      netPay: 285000,
    })

    expect(result instanceof Payslip).toBe(false)

    if (result instanceof Payslip === false && result instanceof Error === false) {
      expect(result.reason).toBe("payslip_not_found")
    }
  })

  test("returns not_editable for a draft payslip", async () => {
    const { context } = createTestContext()

    const payslipId = await seedDraftPayslip(context)

    const result = await new CorrectPayslip(context).run({
      viewerRole: "admin",
      payslipId: payslipId,
      period: "2026-05",
      baseSalary: 310000,
      allowances: 25000,
      deductions: 50000,
      netPay: 285000,
    })

    expect(result instanceof Payslip).toBe(false)

    if (result instanceof Payslip === false && result instanceof Error === false) {
      expect(result.reason).toBe("not_editable")
    }
  })
})

describe("CancelPayslip", () => {
  test("privileged role cancels a draft payslip", async () => {
    const { context } = createTestContext()

    const payslipId = await seedDraftPayslip(context)

    const result = await new CancelPayslip(context).run({
      viewerRole: "admin",
      payslipId: payslipId,
    })

    if (result instanceof Error) {
      throw new Error("expected a tagged result")
    }

    expect(result.reason).toBe("cancelled")

    const after = await new PayslipRepository(context).findById(payslipId)

    expect(after).toBeNull()
  })

  test("returns not_cancellable for an issued payslip", async () => {
    const { context } = createTestContext()

    const payslipId = await seedPayslip(context)

    const result = await new CancelPayslip(context).run({
      viewerRole: "admin",
      payslipId: payslipId,
    })

    if (result instanceof Error) {
      throw new Error("expected a tagged result")
    }

    expect(result.reason).toBe("not_cancellable")
  })

  test("returns forbidden for a non-privileged role", async () => {
    const { context } = createTestContext()

    const payslipId = await seedDraftPayslip(context)

    const result = await new CancelPayslip(context).run({
      viewerRole: "member",
      payslipId: payslipId,
    })

    if (result instanceof Error) {
      throw new Error("expected a tagged result")
    }

    expect(result.reason).toBe("forbidden")
  })

  test("returns payslip_not_found for a missing payslip", async () => {
    const { context } = createTestContext()

    const result = await new CancelPayslip(context).run({
      viewerRole: "admin",
      payslipId: 9999,
    })

    if (result instanceof Error) {
      throw new Error("expected a tagged result")
    }

    expect(result.reason).toBe("payslip_not_found")
  })
})
