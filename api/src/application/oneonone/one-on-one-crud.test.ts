import { describe, expect, test } from "bun:test"
import { OneOnOne } from "@/domain/oneonone/one-on-one.entity"
import { CreateOneOnOne } from "@/application/oneonone/create-one-on-one"
import { GetOneOnOne } from "@/application/oneonone/get-one-on-one"
import { UpdateOneOnOne } from "@/application/oneonone/update-one-on-one"
import { DeleteOneOnOne } from "@/application/oneonone/delete-one-on-one"
import { ListMyOneOnOnes } from "@/application/oneonone/list-my-one-on-ones"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import type { Context } from "@/env"

async function seedEmployees(db: D1Database): Promise<void> {
  await seedD1(db, "employees", [
    {
      id: 1,
      code: "E001",
      name: "Manager",
      email: "you+manager@example.com",
      password_hash: "pbkdf2:dummy",
      role: "manager",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
    {
      id: 2,
      code: "E002",
      name: "Member",
      email: "you+member@example.com",
      password_hash: "pbkdf2:dummy",
      role: "member",
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
    },
  ])
}

async function seedOneOnOne(context: Context, db: D1Database): Promise<OneOnOne> {
  await seedEmployees(db)

  const result = await new CreateOneOnOne(context).run({
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

describe("GetOneOnOne", () => {
  test("returns the record for a participant", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new GetOneOnOne(context).run({
      oneOnOneId: created.id,
      viewerId: 1,
    })

    expect(result).toBeInstanceOf(OneOnOne)
  })

  test("allows member to view", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new GetOneOnOne(context).run({
      oneOnOneId: created.id,
      viewerId: 2,
    })

    expect(result).toBeInstanceOf(OneOnOne)
  })

  test("rejects non-participant with not_participant", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new GetOneOnOne(context).run({
      oneOnOneId: created.id,
      viewerId: 999,
    })

    expectApplicationError(result, ForbiddenError, "not_participant")
  })

  test("rejects unknown id with one_on_one_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetOneOnOne(context).run({
      oneOnOneId: "00000000-0000-0000-0000-000000000000",
      viewerId: 1,
    })

    expectApplicationError(result, NotFoundError, "one_on_one_not_found")
  })
})

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

describe("DeleteOneOnOne", () => {
  test("deletes the record for the manager", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new DeleteOneOnOne(context).run({
      oneOnOneId: created.id,
      managerId: 1,
    })

    expect(result).toEqual({ reason: "deleted" })
  })

  test("rejects non-manager with not_manager", async () => {
    const { context, db } = createTestContext()

    const created = await seedOneOnOne(context, db)

    const result = await new DeleteOneOnOne(context).run({
      oneOnOneId: created.id,
      managerId: 999,
    })

    expectApplicationError(result, ForbiddenError, "not_manager")
  })

  test("rejects unknown id with one_on_one_not_found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteOneOnOne(context).run({
      oneOnOneId: "00000000-0000-0000-0000-000000000000",
      managerId: 1,
    })

    expectApplicationError(result, NotFoundError, "one_on_one_not_found")
  })
})

describe("ListMyOneOnOnes", () => {
  test("returns 1on1s for the participant", async () => {
    const { context, db } = createTestContext()

    await seedOneOnOne(context, db)

    const result = await new ListMyOneOnOnes(context).run({
      employeeId: 1,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
  })

  test("returns empty list for non-participant", async () => {
    const { context, db } = createTestContext()

    await seedOneOnOne(context, db)

    const result = await new ListMyOneOnOnes(context).run({
      employeeId: 999,
      limit: 10,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(0)
  })
})
