import { testDerivedId } from "@system/test/system-test-id.test-support"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { SendThanks } from "@/contexts/thanks/application/send-thanks"
import { Thanks } from "@/contexts/thanks/domain/entities/thanks.entity"
import { ThanksPointBudget } from "@/contexts/thanks/domain/entities/thanks-point-budget.entity"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

function activeEmployee(code: string, name: string): CompanyEmployeeDirectoryEntry {
  return {
    id: toWorkforceEmployeeId(testDerivedId("employee", code)),
    officialName: name,
    employeeCode: code,
    email: null,
    phone: null,
    employment: {
      id: restoreWorkforceId("employment", testDerivedId("employment", code)),
      status: "ACTIVE",
    },
    primaryAssignment: null,
  }
}

/**
 * 従業員名簿・感謝・原資を型付きfakeにしてSendThanksの業務判断だけを検証する。
 * 名簿の実データ解決と感謝の保存は send-thanks.d1.test.ts がローカルD1で検証する。
 */
function createSendThanks(employees: ReadonlyArray<CompanyEmployeeDirectoryEntry>) {
  const created: Thanks[] = []

  const sendThanks = new SendThanks({
    employeeDirectory: {
      findById: async (id: EmployeeId) => employees.find((employee) => employee.id === id) ?? null,
      findByCode: async (code: string) =>
        employees.find((employee) => employee.employeeCode === code) ?? null,
    },
    thanksRepository: {
      consumeBudgetAndCreate: async ({ thanksRecord }) => {
        const saved = new Thanks({
          id: `01900028-0000-7000-8000-${String(created.length + 1).padStart(12, "0")}`,
          senderEmployeeId: thanksRecord.senderEmployeeId,
          recipientEmployeeId: thanksRecord.recipientEmployeeId,
          message: thanksRecord.message,
          points: thanksRecord.points,
          createdAt: thanksRecord.createdAt,
        })
        created.push(saved)
        return saved
      },
    },
    budgetRepository: {
      findOrCreate: async (props) => ThanksPointBudget.create({ ...props, grantedPoints: 100 }),
    },
  })

  return { sendThanks, created }
}

describe("SendThanks", () => {
  test("rejects self-thanks with reason self_thanks", async () => {
    const alice = activeEmployee("E100", "Alice")
    const { sendThanks, created } = createSendThanks([alice, activeEmployee("E101", "Bob")])

    const result = await sendThanks.run({
      senderEmployeeId: alice.id,
      recipientEmployeeCode: "E100",
      message: "ありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "self_thanks")
    expect(created).toEqual([])
  })

  test("sends thanks to another employee successfully", async () => {
    const alice = activeEmployee("E200", "Alice")
    const bob = activeEmployee("E201", "Bob")
    const { sendThanks, created } = createSendThanks([alice, bob])

    const result = await sendThanks.run({
      senderEmployeeId: alice.id,
      recipientEmployeeCode: "E201",
      message: "助けてくれてありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Thanks)
    expect(created.map((thanks) => thanks.recipientEmployeeId)).toEqual([bob.id])
  })

  test("returns recipient_not_found for unknown recipient", async () => {
    const alice = activeEmployee("E300", "Alice")
    const { sendThanks } = createSendThanks([alice])

    const result = await sendThanks.run({
      senderEmployeeId: alice.id,
      recipientEmployeeCode: "E999",
      message: "ありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "recipient_not_found")
  })
})
