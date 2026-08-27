import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { SendThanks } from "@/contexts/thanks/application/send-thanks"
import { Thanks } from "@/contexts/thanks/domain/entities/thanks.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { employments } from "@/contexts/company/infrastructure/schema/employment"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { createTestContext } from "@/api/test/support/create-test-context"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function seedEmployee(
  context: Awaited<ReturnType<typeof createTestContext>>["context"],
  code: string,
  name: string,
): Promise<EmployeeId> {
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

  return employeeId
}

describe("SendThanks", () => {
  test("rejects self-thanks with reason self_thanks", async () => {
    const { context } = await createTestContext()

    const senderId = await seedEmployee(context, "E100", "Alice")
    await seedEmployee(context, "E101", "Bob")

    const result = await new SendThanks({ context }).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E100",
      message: "ありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "self_thanks")
  })

  test("sends thanks to another employee successfully", async () => {
    const { context } = await createTestContext()

    const senderId = await seedEmployee(context, "E200", "Alice")
    await seedEmployee(context, "E201", "Bob")

    const result = await new SendThanks({ context }).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E201",
      message: "助けてくれてありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Thanks)
  })

  test("returns recipient_not_found for unknown recipient", async () => {
    const { context } = await createTestContext()

    const senderId = await seedEmployee(context, "E300", "Alice")

    const result = await new SendThanks({ context }).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E999",
      message: "ありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "recipient_not_found")
  })
})
