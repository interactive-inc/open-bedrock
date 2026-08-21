import { describe, expect, test } from "bun:test"
import { OneOnOne } from "@/contexts/one-on-one/domain/oneonone/one-on-one.entity"
import { CreateOneOnOne } from "@/contexts/one-on-one/application/oneonone/create-one-on-one"
import { UpdateOneOnOne } from "@/contexts/one-on-one/application/oneonone/update-one-on-one"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@/api/test/support/expect-application-error"
import { createTestContext } from "@/api/test/support/create-test-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import type { Context } from "@/env"

async function seedEmployees(db: D1Database): Promise<void> {
  await seedD1(db, "employees", [
    {
      id: 1,
      code: "E001",
      name: "Manager",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
    {
      id: 2,
      code: "E002",
      name: "Member",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
  ])

  // email から対象社員を解決するため、identities(認証情報)も用意する。
  await seedIamForEmployees(db, [
    { id: 1, email: "you+manager@example.com", passwordHash: "pbkdf2:dummy", role: "manager" },
    { id: 2, email: "you+member@example.com", passwordHash: "pbkdf2:dummy", role: "member" },
  ])
}

async function seedOneOnOne(context: Context, db: D1Database): Promise<OneOnOne> {
  await seedEmployees(db)

  const result = await new CreateOneOnOne(context).run({
    memberCode: null,
    memberEmail: "you+member@example.com",
    managerId: 1,
    heldAt: "2026-03-15T10:00:00.000Z",
    topics: "progress review",
    managerNote: null,
    nextAction: null,
  })

  if (result instanceof Error) {
    throw new Error("seed failed")
  }

  return result
}

describe("CreateOneOnOne", () => {
  test("creates a 1on1 record", async () => {
    const { context, db } = createTestContext()

    await seedEmployees(db)

    const result = await new CreateOneOnOne(context).run({
      memberCode: null,
      memberEmail: "you+member@example.com",
      managerId: 1,
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: "goals",
      managerNote: "good progress",
      nextAction: "prepare report",
    })

    expect(result).toBeInstanceOf(OneOnOne)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.memberId).toBe(2)
    expect(result.managerId).toBe(1)
    expect(result.topics).toBe("goals")
  })

  test("rejects unknown member email with member_not_found", async () => {
    const { context, db } = createTestContext()

    await seedEmployees(db)

    const result = await new CreateOneOnOne(context).run({
      memberCode: null,
      memberEmail: "you+unknown@example.com",
      managerId: 1,
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, NotFoundError, "member_not_found")
  })

  test("rejects self reference with self_reference", async () => {
    const { context, db } = createTestContext()

    await seedEmployees(db)

    const result = await new CreateOneOnOne(context).run({
      memberCode: null,
      memberEmail: "you+manager@example.com",
      managerId: 1,
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, ValidationError, "self_reference")
  })
})

describe("GetOneOnOne", () => {})

describe("UpdateOneOnOne", () => {
  test("updates the record for the manager", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new UpdateOneOnOne(context).run({
      oneOnOneId: created.id,
      managerId: 1,
      topics: "updated topics",
      managerNote: "new note",
      nextAction: "action item",
    })

    expect(result).toBeInstanceOf(OneOnOne)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.topics).toBe("updated topics")
    expect(result.managerNote).toBe("new note")
  })

  test("rejects non-manager with not_manager", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new UpdateOneOnOne(context).run({
      oneOnOneId: created.id,
      managerId: 999,
      topics: "hacked",
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, ForbiddenError, "not_manager")
  })
})

describe("DeleteOneOnOne", () => {})

describe("ListMyOneOnOnes", () => {})
