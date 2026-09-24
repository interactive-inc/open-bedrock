import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { employments } from "@/contexts/company/infrastructure/schema/employment"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareUnpublishedEmployment } from "@/contexts/company/test/unpublished-employment.test-support"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { SendThanks } from "@/contexts/thanks/application/send-thanks"
import { Thanks } from "@/contexts/thanks/domain/entities/thanks.entity"
import { ThanksRepository } from "@/contexts/thanks/infrastructure/repositories/thanks.repository"
import { ThanksPointBudgetRepository } from "@/contexts/thanks/infrastructure/repositories/thanks-points/thanks-point-budget.repository"
import type { Context } from "@/env"
import { publishTestEmployeeResources } from "@tests/api/support/company/publish-test-employee-resources"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["send"] })
})

afterAll(async () => {
  await local.dispose()
})

async function seedEmployee(context: Context, code: string, name: string): Promise<EmployeeId> {
  const employeeId = toWorkforceEmployeeId(`employee:${code}`)

  await context.var.database.insert(employees).values({
    id: employeeId,
    officialName: name,
    employeeCode: code,
    email: null,
    phone: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })
  await context.var.database.insert(employments).values({
    id: `employment:${code}`,
    employeeId,
    contractName: name,
    employmentType: "FULL_TIME",
    hireDate: "1970-01-01",
    status: "ACTIVE",
    terminationDate: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })

  const initialEmployment = await prepareUnpublishedEmployment(context.env.DB, {
    employeeId,
    employmentId: restoreWorkforceId("employment", `employment:${code}`),
    effectiveOn: restoreCalendarDate("1970-01-01"),
    status: "active",
    occurredAt: new Date(0),
    actorAccountId: null,
    operationId: `seed:${code}`,
    reason: "Initial test employment",
  })
  await context.env.DB.batch([...initialEmployment])
  await publishTestEmployeeResources(context.env.DB, {
    employeeId: String(employeeId),
    employmentId: `employment:${code}`,
    officialName: name,
    employeeCode: code,
    employmentType: "FULL_TIME",
    employmentStatus: "ACTIVE",
    effectiveFrom: "1970-01-01",
    recordedAt: 0,
  })

  return employeeId
}

describe("SendThanks on local D1", () => {
  test("resolves the recipient from the company directory and stores the thanks", async () => {
    const { context, db } = await createLocalD1Context(local, "send")

    const senderId = await seedEmployee(context, "E200", "Alice")
    const recipientId = await seedEmployee(context, "E201", "Bob")

    const result = await new SendThanks({
      employeeDirectory: openCompanyEmployeeDirectory(context),
      thanksRepository: new ThanksRepository(context),
      budgetRepository: new ThanksPointBudgetRepository(context),
    }).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E201",
      message: "助けてくれてありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Thanks)

    const rows = await db
      .prepare("SELECT sender_employee_id, recipient_employee_id, message FROM thanks_messages")
      .all<{ sender_employee_id: string; recipient_employee_id: string; message: string }>()

    expect(rows.results).toEqual([
      {
        sender_employee_id: String(senderId),
        recipient_employee_id: String(recipientId),
        message: "助けてくれてありがとう",
      },
    ])
  })
})
