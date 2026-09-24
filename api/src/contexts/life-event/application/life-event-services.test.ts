import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateLifeEvent } from "@/contexts/life-event/application/create-life-event"
import { UpdateLifeEvent } from "@/contexts/life-event/application/update-life-event"
import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { ApplicationError, ConflictError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

/** ライフイベント届出のRepositoryを型付きfakeにして、application の業務判断だけを検証する。 */
function createRepository() {
  const stored = new Map<string, LifeEvent>()

  return {
    stored,
    repository: {
      create: async (lifeEvent: LifeEvent) => {
        stored.set(lifeEvent.id, lifeEvent)
        return lifeEvent
      },
      findById: async (id: string) => stored.get(id) ?? null,
      update: async (lifeEvent: LifeEvent) => {
        if (stored.get(lifeEvent.id)?.status !== "submitted") return null
        stored.set(lifeEvent.id, lifeEvent)
        return lifeEvent
      },
    },
  }
}

type Repository = ReturnType<typeof createRepository>["repository"]

async function seedEvent(repository: Repository, employeeId: number): Promise<string> {
  const created = await new CreateLifeEvent({ lifeEventRepository: repository }).run({
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
    const { repository, stored } = createRepository()

    const created = await new CreateLifeEvent({ lifeEventRepository: repository }).run({
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
    expect(stored.get(created.id)).toBe(created)
  })
})

describe("UpdateLifeEvent", () => {
  test("updates the details for the applicant", async () => {
    const { repository } = createRepository()

    const lifeEventId = await seedEvent(repository, 5)

    const result = await new UpdateLifeEvent({ lifeEventRepository: repository }).run({
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
    const { repository } = createRepository()

    const lifeEventId = await seedEvent(repository, 5)

    const result = await new UpdateLifeEvent({ lifeEventRepository: repository }).run({
      lifeEventId: lifeEventId,
      employeeId: toWorkforceEmployeeId(6),
      eventType: "childbirth",
      eventDate: "2026-07-01",
      detail: null,
    })

    expectApplicationError(result, ForbiddenError, "not_applicant")
  })

  test("maps a zero-row conditional update to not_modifiable", async () => {
    const { repository } = createRepository()

    const lifeEventId = await seedEvent(repository, 5)

    const result = await new UpdateLifeEvent({
      lifeEventRepository: { ...repository, update: async () => null },
    }).run({
      lifeEventId: lifeEventId,
      employeeId: toWorkforceEmployeeId(5),
      eventType: "childbirth",
      eventDate: "2026-07-01",
      detail: null,
    })

    expectApplicationError(result, ConflictError, "not_modifiable")
  })
})
