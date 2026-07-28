import { describe, expect, test } from "bun:test"
import { CancelLifeEvent } from "@/application/life-event/cancel-life-event"
import { CreateLifeEvent } from "@/application/life-event/create-life-event"
import { GetLifeEvent } from "@/application/life-event/get-life-event"
import { ListMyLifeEvents } from "@/application/life-event/list-my-life-events"
import { UpdateLifeEvent } from "@/application/life-event/update-life-event"
import { LifeEvent } from "@/domain/life-event/life-event.entity"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"

async function seedEvent(context: Context, employeeId: number): Promise<string> {
  const created = await new CreateLifeEvent(context).run({
    employeeId: employeeId,
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
    const { context } = createTestContext()

    const created = await new CreateLifeEvent(context).run({
      employeeId: 2,
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

describe("GetLifeEvent", () => {
  test("returns the event for its applicant", async () => {
    const { context } = createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new GetLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: 5,
    })

    expect(result).toBeInstanceOf(LifeEvent)
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new GetLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: 6,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })

  test("returns life_event_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetLifeEvent(context).run({
      lifeEventId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      employeeId: 5,
    })

    expectApplicationError(result, NotFoundError, "life_event_not_found")
  })
})

describe("ListMyLifeEvents", () => {
  test("returns only the applicant's events", async () => {
    const { context } = createTestContext()

    await seedEvent(context, 5)

    await seedEvent(context, 6)

    const result = await new ListMyLifeEvents(context).run({ employeeId: 5, limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].employeeId).toBe(5)
  })
})

describe("UpdateLifeEvent", () => {
  test("updates the details for the applicant", async () => {
    const { context } = createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new UpdateLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: 5,
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
    const { context } = createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new UpdateLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: 6,
      eventType: "childbirth",
      eventDate: "2026-07-01",
      detail: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })
})

describe("CancelLifeEvent", () => {
  test("cancels the event for the applicant", async () => {
    const { context } = createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new CancelLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non applicant with not_applicant", async () => {
    const { context } = createTestContext()

    const lifeEventId = await seedEvent(context, 5)

    const result = await new CancelLifeEvent(context).run({
      lifeEventId: lifeEventId,
      employeeId: 6,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })
})
