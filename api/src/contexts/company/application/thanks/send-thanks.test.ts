import { SendThanks } from "@/contexts/company/application/thanks/send-thanks"
import { Thanks } from "@/contexts/company/domain/thanks/thanks.entity"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee-repository"
import { expectApplicationError } from "@/contexts/company/interface/test-helpers/expect-application-error"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { NotFoundError, ValidationError } from "@/lib/errors"
import { describe, expect, test } from "bun:test"

async function seedEmployee(
  context: Parameters<typeof EmployeeRepository.prototype.create>[0] extends never
    ? never
    : ReturnType<typeof createTestContext>["context"],
  code: string,
  name: string,
): Promise<number> {
  const repository = new EmployeeRepository(context)

  const created = await repository.create({
    code,
    name,
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: "active",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  await context.env.DB.prepare(
    `INSERT INTO accounts (id, status, token_version, created_at, updated_at)
     VALUES (?1, 'active', 0, 0, 0)`,
  )
    .bind(created.id)
    .run()
  await context.env.DB.prepare(
    "INSERT INTO account_employee_links (account_id, employee_id) VALUES (?1, ?1)",
  )
    .bind(created.id)
    .run()

  return created.id
}

describe("SendThanks", () => {
  test("rejects self-thanks with reason self_thanks", async () => {
    const { context } = createTestContext()

    const senderId = await seedEmployee(context, "E100", "Alice")
    await seedEmployee(context, "E101", "Bob")

    const result = await new SendThanks(context).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E100",
      message: "ありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "self_thanks")
  })

  test("sends thanks to another employee successfully", async () => {
    const { context } = createTestContext()

    const senderId = await seedEmployee(context, "E200", "Alice")
    await seedEmployee(context, "E201", "Bob")

    const result = await new SendThanks(context).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E201",
      message: "助けてくれてありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(Thanks)
  })

  test("returns recipient_not_found for unknown recipient", async () => {
    const { context } = createTestContext()

    const senderId = await seedEmployee(context, "E300", "Alice")

    const result = await new SendThanks(context).run({
      senderEmployeeId: senderId,
      recipientEmployeeCode: "E999",
      message: "ありがとう",
      points: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "recipient_not_found")
  })
})
