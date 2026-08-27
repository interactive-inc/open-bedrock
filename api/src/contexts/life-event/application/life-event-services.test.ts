import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateLifeEvent } from "@/contexts/life-event/application/create-life-event"
import { UpdateLifeEvent } from "@/contexts/life-event/application/update-life-event"
import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { ForbiddenError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { createTestContext } from "@tests/api/support/create-test-context"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

async function seedEvent(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateLifeEvent(context).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    eventType: "marriage",
    eventDate: "2026-05-10",
    detail: "氏名変更の手続きを予定",
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateLifeEvent", () => {
  test("creates a life event with status submitted", async () => {
    const { context } = await createTestContext()

    const created = await new CreateLifeEvent(context).run({
      employeeId: toWorkforceEmployeeId(2),
      eventType: "relocation",
      eventDate: "2026-05-20",
      detail: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(LifeEvent)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("submitted")
    expect(created.detail).toBe(null)
  })
})

describe("GetLifeEvent", () => {})

describe("ListMyLifeEvents", () => {})

describe("UpdateLifeEvent", () => {
  test("updates the details for the applicant", async () => {
    const { context } = await createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new UpdateLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: toWorkforceEmployeeId(5),
      eventType: "childbirth",
      eventDate: "2026-07-01",
      detail: "扶養変更の届出を予定",
    })

    expect(result).toBeInstanceOf(LifeEvent)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.eventType).toBe("childbirth")
    expect(result.detail).toBe("扶養変更の届出を予定")
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = await createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new UpdateLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: toWorkforceEmployeeId(6),
      eventType: "childbirth",
      eventDate: "2026-07-01",
      detail: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })
})

describe("CancelLifeEvent", () => {})
