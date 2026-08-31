import { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"
import { wrapSystemD1TestDatabase } from "@system/test/wrap-system-d1-test-database.test-support"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const coreSql = readFileSync(new URL("../../schema/system-core.sql", import.meta.url), "utf8")
const deliverySql = readFileSync(
  new URL("../../schema/system-delivery.sql", import.meta.url),
  "utf8",
)
const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = zAccountId.parse("account:1")

describe("SystemDeliveryRepository", () => {
  test("jobを冪等登録し、lease失敗をdead letterと同じtransactionで確定する", async () => {
    const fixture = createFixture()
    const repository = new SystemDeliveryRepository({ env: { DB: fixture.database } })
    const queued = createDelivery("a".repeat(64))
    expect(await repository.create(queued, accountId, null, [])).toBe("created")
    expect(await repository.create(queued, accountId, null, [])).toBe("replayed")
    expect(await repository.create(createDelivery("b".repeat(64)), accountId, null, [])).toBe(
      "conflict",
    )

    const leased = queued.claim(accountId, "c".repeat(64), now, 10_000)
    expect(leased).toBeInstanceOf(SystemDeliveryEntity)
    if (!(leased instanceof SystemDeliveryEntity)) return
    expect(await repository.update(queued, leased, [])).toBe("updated")
    const failed = leased.fail(
      accountId,
      "c".repeat(64),
      "remote.failed",
      new Date(now.getTime() + 1_000),
      new Date(now.getTime() + 2_000),
    )
    expect(failed).toBeInstanceOf(SystemDeliveryEntity)
    if (!(failed instanceof SystemDeliveryEntity)) return
    expect(await repository.update(leased, failed, [])).toBe("updated")
    const deadLetters = await repository.findDeadLetters()
    expect(deadLetters).toMatchObject([
      { sourceType: "job", sourceId: "job:1", reasonCode: "remote.failed", attempt: 1 },
    ])
    if (deadLetters instanceof Error || deadLetters[0] === undefined) return
    const requeued = createRequeuedDelivery(deadLetters[0].id, deadLetters[0].payloadDigest)
    expect(await repository.requeueDeadLetter(deadLetters[0].id, requeued, accountId, [])).toEqual({
      status: "created",
      jobId: requeued.id,
    })
    expect(await repository.requeueDeadLetter(deadLetters[0].id, requeued, accountId, [])).toEqual({
      status: "replayed",
      jobId: requeued.id,
    })
  })

  test("inboxの同一外部messageをdigestで再生判定し、拒否をdead letterへ残す", async () => {
    const fixture = createFixture()
    const repository = new SystemDeliveryRepository({ env: { DB: fixture.database } })
    const input = {
      id: "inbox:1",
      sourceKey: "source:1",
      externalMessageId: "external:1",
      payloadDigest: "d".repeat(64),
      receivedAt: now,
    }
    expect(await repository.acceptInbox(input, [])).toBe("accepted")
    expect(await repository.acceptInbox({ ...input, id: "inbox:2" }, [])).toBe("replayed")
    expect(
      await repository.acceptInbox({ ...input, id: "inbox:3", payloadDigest: "e".repeat(64) }, []),
    ).toBe("conflict")
    expect(
      await repository.completeInbox(
        input.id,
        "rejected",
        "signature.invalid",
        new Date(now.getTime() + 1_000),
        [],
      ),
    ).toBe("updated")
    expect(await repository.findDeadLetters()).toMatchObject([
      { sourceType: "inbox", sourceId: "inbox:1", reasonCode: "signature.invalid" },
    ])
  })
})

function createFixture(): Readonly<{ database: D1Database }> {
  const sqlite = new Database(":memory:")
  sqlite.exec("PRAGMA foreign_keys = ON")
  sqlite.exec(coreSql)
  sqlite.exec(deliverySql)
  sqlite.exec(
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('account:1', 'active', 0, 1, 1);`,
  )
  return { database: wrapSystemD1TestDatabase(sqlite) }
}

function createDelivery(payloadDigest: string): SystemDeliveryEntity {
  const delivery = SystemDeliveryEntity.create({
    id: "job:1",
    kind: "job",
    operationKey: "record.process",
    payloadDigest,
    idempotencyKey: "command:1",
    status: "queued",
    attempt: 0,
    maxAttempts: 1,
    availableAt: now,
    leaseAccountId: null,
    leaseTokenHash: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  })
  if (delivery instanceof Error) throw delivery
  return delivery
}

function createRequeuedDelivery(deadLetterId: string, payloadDigest: string): SystemDeliveryEntity {
  const delivery = SystemDeliveryEntity.create({
    id: "job:requeued",
    kind: "job",
    operationKey: "system.dead_letter.reprocess.job",
    payloadDigest,
    idempotencyKey: `dead-letter:${deadLetterId}`,
    status: "queued",
    attempt: 0,
    maxAttempts: 3,
    availableAt: new Date(now.getTime() + 2_000),
    leaseAccountId: null,
    leaseTokenHash: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: new Date(now.getTime() + 2_000),
    updatedAt: new Date(now.getTime() + 2_000),
    completedAt: null,
  })
  if (delivery instanceof Error) throw delivery
  return delivery
}
