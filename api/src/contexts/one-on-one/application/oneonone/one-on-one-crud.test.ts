import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import { describe, expect, test } from "bun:test"
import { OneOnOne } from "@/contexts/one-on-one/domain/entities/one-on-one.entity"
import { CreateOneOnOne } from "@/contexts/one-on-one/application/oneonone/create-one-on-one"
import { UpdateOneOnOne } from "@/contexts/one-on-one/application/oneonone/update-one-on-one"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

function directoryEntry(id: number, code: string, name: string): CompanyEmployeeDirectoryEntry {
  return {
    id: toWorkforceEmployeeId(id),
    officialName: name,
    employeeCode: code,
    email: null,
    phone: null,
    employment: null,
    primaryAssignment: null,
  }
}

const employees = [directoryEntry(1, "E001", "Manager"), directoryEntry(2, "E002", "Member")]

/** 従業員名簿と1on1 Repositoryを型付きfakeにして、DBなしで業務判断を検証する。 */
function createOneOnOneTestContext() {
  const records = new Map<string, OneOnOne>()

  return {
    employeeDirectory: {
      findByCode: async (code: string) =>
        employees.find((employee) => employee.employeeCode === code) ?? null,
    },
    oneOnOneRepository: {
      findById: async (id: string) => records.get(id) ?? null,
      save: async (oneOnOne: OneOnOne) => {
        records.set(oneOnOne.id, oneOnOne)
        return oneOnOne
      },
      update: async (oneOnOne: OneOnOne) => {
        if (!records.has(oneOnOne.id)) return null
        records.set(oneOnOne.id, oneOnOne)
        return oneOnOne
      },
    },
  }
}

type OneOnOneTestContext = ReturnType<typeof createOneOnOneTestContext>

async function seedOneOnOne(context: OneOnOneTestContext): Promise<OneOnOne> {
  const result = await new CreateOneOnOne(context).run({
    memberCode: "E002",
    managerId: toWorkforceEmployeeId(1),
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
    const context = createOneOnOneTestContext()

    const result = await new CreateOneOnOne(context).run({
      memberCode: "E002",
      managerId: toWorkforceEmployeeId(1),
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: "goals",
      managerNote: "good progress",
      nextAction: "prepare report",
    })

    expect(result).toBeInstanceOf(OneOnOne)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.memberId).toBe(toWorkforceEmployeeId(2))
    expect(result.managerId).toBe(toWorkforceEmployeeId(1))
    expect(result.topics).toBe("goals")
    expect(await context.oneOnOneRepository.findById(result.id)).toBe(result)
  })

  test("rejects unknown member code with member_not_found", async () => {
    const context = createOneOnOneTestContext()

    const result = await new CreateOneOnOne(context).run({
      memberCode: "UNKNOWN",
      managerId: toWorkforceEmployeeId(1),
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, NotFoundError, "member_not_found")
  })

  test("rejects self reference with self_reference", async () => {
    const context = createOneOnOneTestContext()

    const result = await new CreateOneOnOne(context).run({
      memberCode: "E001",
      managerId: toWorkforceEmployeeId(1),
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, ValidationError, "self_reference")
  })

  test("maps a frozen record source to record_source_frozen", async () => {
    const context = createOneOnOneTestContext()

    const result = await new CreateOneOnOne({
      ...context,
      oneOnOneRepository: {
        save: async () => new Error("D1_ERROR: one_on_one_record_source_frozen"),
      },
    }).run({
      memberCode: "E002",
      managerId: toWorkforceEmployeeId(1),
      heldAt: "2026-03-15T10:00:00.000Z",
      topics: null,
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, ConflictError, "record_source_frozen")
  })
})

describe("GetOneOnOne", () => {})

describe("UpdateOneOnOne", () => {
  test("updates the record for the manager", async () => {
    const context = createOneOnOneTestContext()

    const created = await seedOneOnOne(context)

    const result = await new UpdateOneOnOne(context).run({
      oneOnOneId: created.id,
      managerId: toWorkforceEmployeeId(1),
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
    const context = createOneOnOneTestContext()

    const created = await seedOneOnOne(context)

    const result = await new UpdateOneOnOne(context).run({
      oneOnOneId: created.id,
      managerId: toWorkforceEmployeeId(999),
      topics: "hacked",
      managerNote: null,
      nextAction: null,
    })

    expectApplicationError(result, ForbiddenError, "not_manager")
    expect((await context.oneOnOneRepository.findById(created.id))?.topics).toBe("progress review")
  })
})

describe("DeleteOneOnOne", () => {})

describe("ListMyOneOnOnes", () => {})
