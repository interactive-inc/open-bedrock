import { describe, expect, test } from "bun:test"
import { OrgDepartment } from "@/domain/org/org-department.entity"
import { CreateOrgDepartment } from "@/application/org/create-org-department"
import { GetOrgDepartment } from "@/application/org/get-org-department"
import { UpdateOrgDepartment } from "@/application/org/update-org-department"
import { DeleteOrgDepartment } from "@/application/org/delete-org-department"
import { ListOrgDepartments } from "@/application/org/list-org-departments"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import type { Context } from "@/env"

async function seedDepartment(context: Context, code: string): Promise<OrgDepartment> {
  const result = await new CreateOrgDepartment(context).run({
    session: makeTestSession("admin"),
    department: {
      code: code,
      departmentId: 100,
      parentCode: null,
      managerEmployeeCode: null,
      order: 1,
    },
  })

  if (result instanceof ApplicationError) {
    throw new Error("seed failed")
  }

  return result
}

describe("CreateOrgDepartment", () => {
  test("creates a department for an admin", async () => {
    const { context } = createTestContext()

    const result = await new CreateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      department: {
        code: "DEV",
        departmentId: 1,
        parentCode: null,
        managerEmployeeCode: null,
        order: 1,
      },
    })

    expect(result).toBeInstanceOf(OrgDepartment)

    if (result instanceof ApplicationError) {
      throw new Error("create failed")
    }

    expect(result.code).toBe("DEV")
  })

  test("rejects non-admin with forbidden", async () => {
    const { context } = createTestContext()

    const result = await new CreateOrgDepartment(context).run({
      session: makeTestSession("member"),
      department: {
        code: "DEV",
        departmentId: 1,
        parentCode: null,
        managerEmployeeCode: null,
        order: 1,
      },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects duplicate code with department_code_conflict", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")

    const result = await new CreateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      department: {
        code: "DEV",
        departmentId: 2,
        parentCode: null,
        managerEmployeeCode: null,
        order: 2,
      },
    })

    expectApplicationError(result, ConflictError, "department_code_conflict")
  })

  test("requires a personnel action for the initial department responsibility", async () => {
    const { context } = createTestContext()
    const result = await new CreateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      department: {
        code: "DEV",
        departmentId: 1,
        parentCode: null,
        managerEmployeeCode: "E001",
        order: 1,
      },
    })
    expectApplicationError(result, ConflictError, "lifecycle_action_required")
  })

  test("creates a child department with a parent", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "CORP")

    const result = await new CreateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      department: {
        code: "DEV",
        departmentId: 2,
        parentCode: "CORP",
        managerEmployeeCode: null,
        order: 1,
      },
    })

    expect(result).toBeInstanceOf(OrgDepartment)
  })
})

describe("GetOrgDepartment", () => {
  test("returns the department by code", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")

    const result = await new GetOrgDepartment(context).run({ code: "DEV" })

    expect(result).toBeInstanceOf(OrgDepartment)
  })

  test("rejects unknown code with department_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetOrgDepartment(context).run({ code: "NOPE" })

    expectApplicationError(result, NotFoundError, "department_not_found")
  })
})

describe("UpdateOrgDepartment", () => {
  test("updates department hierarchy metadata for an admin", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")

    const result = await new UpdateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "DEV",
      parentCode: null,
      managerEmployeeCode: undefined,
      order: 5,
    })

    expect(result).toBeInstanceOf(OrgDepartment)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.managerEmployeeCode).toBeNull()
    expect(result.order).toBe(5)
  })

  test("requires a personnel action to change the department responsibility", async () => {
    const { context } = createTestContext()
    await seedDepartment(context, "DEV")
    const result = await new UpdateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "DEV",
      parentCode: null,
      managerEmployeeCode: "E001",
      order: 1,
    })
    expectApplicationError(result, ConflictError, "lifecycle_action_required")
  })

  test("rejects non-admin with forbidden", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")

    const result = await new UpdateOrgDepartment(context).run({
      session: makeTestSession("member"),
      code: "DEV",
      parentCode: null,
      managerEmployeeCode: null,
      order: 1,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects self-reference with invalid_parent", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")

    const result = await new UpdateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "DEV",
      parentCode: "DEV",
      managerEmployeeCode: null,
      order: 1,
    })

    expectApplicationError(result, ValidationError, "invalid_parent")
  })

  test("rejects unknown code with department_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "NOPE",
      parentCode: null,
      managerEmployeeCode: null,
      order: 1,
    })

    expectApplicationError(result, NotFoundError, "department_not_found")
  })
})

describe("DeleteOrgDepartment", () => {
  test("archives an unused leaf department for an admin and preserves the row", async () => {
    const { context, db } = createTestContext()

    await seedDepartment(context, "DEV")
    await db.prepare("UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1").run()

    const result = await new DeleteOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "DEV",
    })

    expect(result).toEqual({ reason: "archived" })
    expect(
      await db
        .prepare("SELECT archived_at IS NOT NULL FROM org_departments WHERE code = 'DEV'")
        .first<number>("archived_at IS NOT NULL"),
    ).toBe(1)
  })

  test("rejects a department with a current or future lifecycle assignment", async () => {
    const { context, db } = createTestContext()
    await seedDepartment(context, "DEV")
    await db.exec(`
      INSERT INTO org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES ('fixture-assignment', 1, 'fixture-employment', 1, 'DEV', 'primary',
              NULL, NULL, '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_state SET status = 'verified' WHERE id = 1;
    `)
    const result = await new DeleteOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "DEV",
    })
    expectApplicationError(result, ConflictError, "department_in_use")
  })

  test("rejects non-admin with forbidden", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")

    const result = await new DeleteOrgDepartment(context).run({
      session: makeTestSession("member"),
      code: "DEV",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown code with department_not_found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteOrgDepartment(context).run({
      session: makeTestSession("admin"),
      code: "NOPE",
    })

    expectApplicationError(result, NotFoundError, "department_not_found")
  })
})

describe("ListOrgDepartments", () => {
  test("returns all departments", async () => {
    const { context } = createTestContext()

    await seedDepartment(context, "DEV")
    await seedDepartment(context, "SALES")

    const result = await new ListOrgDepartments(context).run()

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(2)
  })

  test("returns empty list when no departments exist", async () => {
    const { context } = createTestContext()

    const result = await new ListOrgDepartments(context).run()

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(0)
  })
})
