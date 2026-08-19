import {
  NotificationReadBatchEntity,
  NotificationReadEntity,
} from "@/contexts/system/domain/notifications/notification-read.entity"
import { NotificationReadRepository } from "@/contexts/system/infrastructure/notifications/notification-read.repository"
import * as schema from "@/contexts/system/infrastructure/schema/system-runtime"
import { notificationReads } from "@/contexts/system/infrastructure/schema/system-runtime"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"

function createTestDatabase(): DrizzleD1Database<typeof schema> {
  const sqlite = new Database(":memory:")

  sqlite.run(`
    CREATE TABLE notification_reads (
      id text PRIMARY KEY,
      notification_id text NOT NULL,
      user_id text NOT NULL,
      read_at integer NOT NULL,
      created_at integer NOT NULL,
      UNIQUE (notification_id, user_id)
    )
  `)

  return drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>
}

function createRead(notificationId: string, userId: string, now: Date): NotificationReadEntity {
  return NotificationReadEntity.create({
    id: `${userId}:${notificationId}`,
    notificationId,
    userId,
    readAt: now,
    createdAt: now,
  })
}

describe("NotificationReadRepository", () => {
  test("broadcast 通知の既読はユーザー間で独立する", async () => {
    const database = createTestDatabase()
    const now = new Date()
    const context = { var: { database } }

    await new NotificationReadRepository(context).write(
      NotificationReadBatchEntity.create([createRead("b1", "userA", now)]),
    )

    const readA = await database.query.notificationReads.findMany({
      where: eq(notificationReads.userId, "userA"),
    })
    const readB = await database.query.notificationReads.findMany({
      where: eq(notificationReads.userId, "userB"),
    })

    expect(readA.map((row) => row.notificationId)).toContain("b1")
    expect(readB.map((row) => row.notificationId)).not.toContain("b1")
  })

  test("同じ通知を二重に既読化しても冪等", async () => {
    const database = createTestDatabase()
    const context = { var: { database } }
    const read = createRead("b1", "userA", new Date())
    const repository = new NotificationReadRepository(context)

    expect(await repository.write(NotificationReadBatchEntity.create([read]))).toBe(1)
    expect(await repository.write(NotificationReadBatchEntity.create([read]))).toBe(0)

    const rows = await database.query.notificationReads.findMany({
      where: eq(notificationReads.userId, "userA"),
      columns: { notificationId: true },
    })
    expect(rows.map((row) => row.notificationId)).toEqual(["b1"])
  })

  test("未読 101 件でもチャンク分割で全件既読化できる", async () => {
    const database = createTestDatabase()
    const context = { var: { database } }
    const now = new Date()
    const reads = Array.from({ length: 101 }, (_, index) => createRead(`n${index}`, "userA", now))

    expect(
      await new NotificationReadRepository(context).write(
        NotificationReadBatchEntity.create(reads),
      ),
    ).toBe(101)
    expect(
      await database.query.notificationReads.findMany({
        where: eq(notificationReads.userId, "userA"),
      }),
    ).toHaveLength(101)
  })

  test("空配列は何も INSERT せず 0 を返す", async () => {
    const repository = new NotificationReadRepository({ var: { database: createTestDatabase() } })

    expect(await repository.write(NotificationReadBatchEntity.create([]))).toBe(0)
  })
})
