import { SendThanks } from "@/application/thanks/send-thanks"
import { Thanks } from "@/domain/thanks/thanks.entity"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
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
    email: `you+${code.toLowerCase()}@example.com`,
    passwordHash: "hash",
    role: "member",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: "active",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

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

    expect(result).toEqual({ reason: "self_thanks" })
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

    expect(result).toEqual({ reason: "recipient_not_found" })
  })
})
