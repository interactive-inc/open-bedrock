import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { LifeEvent } from "@/contexts/life-event/domain/entities/life-event.entity"
import { LifeEventRepository } from "@/contexts/life-event/infrastructure/repositories/life-event.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["create-update"] })
})

afterAll(async () => {
  await local.dispose()
})

describe("LifeEventRepository on local D1", () => {
  test("create persists a submitted event and update changes only a submitted row", async () => {
    const { context, db } = await createLocalD1Context(local, "create-update")

    const repository = new LifeEventRepository(context)

    const created = await repository.create(
      LifeEvent.create({
        employeeId: toWorkforceEmployeeId(testEmployeeId(5)),
        eventType: "marriage",
        eventDate: "2026-05-10",
        detail: "氏名変更の手続きを予定",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) throw created

    const found = await repository.findById(created.id)

    if (found instanceof Error || found === null) throw new Error("life event not found")

    expect(found.status).toBe("submitted")
    expect(found.detail).toBe("氏名変更の手続きを予定")

    const changed = found.withDetails({
      eventType: "childbirth",
      eventDate: "2026-07-01",
      detail: "扶養変更の届出を予定",
    })

    const updated = await repository.update(changed)

    if (updated instanceof Error || updated === null) throw new Error("update failed")

    expect(updated.eventType).toBe("childbirth")
    expect(updated.detail).toBe("扶養変更の届出を予定")

    await db
      .prepare("UPDATE life_events SET status = 'approved' WHERE id = ?1")
      .bind(created.id)
      .run()

    expect(await repository.update(changed)).toBeNull()
  })
})
