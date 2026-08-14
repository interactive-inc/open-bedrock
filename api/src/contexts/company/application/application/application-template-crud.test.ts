import { CreateApplicationTemplate } from "@/contexts/company/application/application/create-application-template"
import { DeleteApplicationTemplate } from "@/contexts/company/application/application/delete-application-template"
import { UpdateApplicationTemplate } from "@/contexts/company/application/application/update-application-template"
import { ApplicationTemplate } from "@/contexts/company/domain/application/application-template.entity"
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from "@/lib/errors"
import { ApplicationTemplateRepository } from "@/contexts/company/infrastructure/application/application-template-repository"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { expectApplicationError } from "@/contexts/company/interface/test-helpers/expect-application-error"
import { makeTestSession } from "@/contexts/company/interface/test-helpers/make-test-session"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { describe, expect, test } from "bun:test"

function seedExpense(db: D1Database): Promise<unknown> {
  return seedD1(db, "application_templates", [
    {
      id: 1,
      code: "expense",
      name: "経費申請",
      category: "expense",
      description: null,
      schema_json: "{}",
      approver_roles: "[]",
    },
  ])
}

function seedApplication(
  db: D1Database,
  templateId: number,
  status: "pending" | "approved" | "rejected",
): Promise<void> {
  return seedD1(db, "application_requests", [
    {
      template_id: templateId,
      applicant_id: 1,
      status: status,
      current_step: null,
      payload: "{}",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ])
}

describe("CreateApplicationTemplate", () => {
  test("a privileged role creates a template", async () => {
    const { context } = createTestContext()

    const result = await new CreateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "leave",
      name: "休暇申請",
      category: "attendance",
      description: null,
      schemaJson: { type: "object" },
      approverRoles: ["manager"],
    })

    expect(result).toBeInstanceOf(ApplicationTemplate)
  })

  test("a non-privileged role is forbidden", async () => {
    const { context } = createTestContext()

    const result = await new CreateApplicationTemplate(context).run({
      session: makeTestSession("member"),
      code: "leave",
      name: "休暇申請",
      category: "attendance",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("a duplicate code conflicts", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new CreateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "expense",
      name: "別の経費申請",
      category: "expense",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    expectApplicationError(result, ConflictError, "template_code_conflict")
  })

  test("rejects an unknown legacy approver role", async () => {
    const { context } = createTestContext()

    const result = await new CreateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "unknown_role",
      name: "Unknown role",
      category: "general",
      description: null,
      schemaJson: {},
      approverRoles: ["missing_role"],
    })

    expectApplicationError(result, UnprocessableError, "unknown_approver_role")
  })
})

describe("UpdateApplicationTemplate", () => {
  test("a privileged role updates a template", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new UpdateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "expense",
      name: "経費精算",
      category: "accounting",
      description: "更新",
      schemaJson: { type: "object" },
      approverRoles: ["root"],
    })

    expect(result).toBeInstanceOf(ApplicationTemplate)

    if (result instanceof ApplicationTemplate) {
      expect(result.name).toBe("経費精算")
    }
  })

  test("a non-privileged role is forbidden", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new UpdateApplicationTemplate(context).run({
      session: makeTestSession("member"),
      code: "expense",
      name: "X",
      category: "expense",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "missing",
      name: "X",
      category: "general",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    expectApplicationError(result, NotFoundError, "template_not_found")
  })

  test("rejects an unknown legacy approver role without changing the template", async () => {
    const { context, db } = createTestContext()
    await seedExpense(db)

    const result = await new UpdateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "expense",
      name: "Changed",
      category: "expense",
      description: null,
      schemaJson: {},
      approverRoles: ["missing_role"],
    })

    expectApplicationError(result, UnprocessableError, "unknown_approver_role")
    expect((await new ApplicationTemplateRepository(context).findByCode("expense"))?.name).toBe(
      "経費申請",
    )
  })

  test("allows display edits but locks system template structure", async () => {
    const { context } = createTestContext()
    const displayEdit = await new UpdateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "personnel_action_request",
      name: "Employee Lifecycle Change",
      category: "employee",
      description: "Updated help text",
      schemaJson: { additionalProperties: false, type: "object" },
      approverRoles: ["hr"],
    })
    expect(displayEdit).toBeInstanceOf(ApplicationTemplate)

    const structuralEdit = await new UpdateApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "personnel_action_request",
      name: "Employee Lifecycle Change",
      category: "general",
      description: null,
      schemaJson: {},
      approverRoles: ["root"],
    })
    expectApplicationError(structuralEdit, UnprocessableError, "system_template_structure_locked")
  })
})

describe("DeleteApplicationTemplate", () => {
  test("a privileged role deletes a template", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new DeleteApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "expense",
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("deleted")

    const repository = new ApplicationTemplateRepository(context)

    const found = await repository.findByCode("expense")

    expect(found).toBeNull()
  })

  test("a non-privileged role is forbidden", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new DeleteApplicationTemplate(context).run({
      session: makeTestSession("member"),
      code: "expense",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "missing",
    })

    expectApplicationError(result, NotFoundError, "template_not_found")
  })

  test("returns template_in_use when pending applications exist", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)
    await seedApplication(db, 1, "pending")

    const result = await new DeleteApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "expense",
    })

    expectApplicationError(result, ConflictError, "template_in_use")
  })

  test("returns template_in_use when a decided (approved) application references it", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)
    await seedApplication(db, 1, "approved")

    const result = await new DeleteApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "expense",
    })

    expectApplicationError(result, ConflictError, "template_in_use")

    // 監査記録破壊を防ぐため、テンプレートは残存している
    const found = await new ApplicationTemplateRepository(context).findByCode("expense")

    expect(found).toBeInstanceOf(ApplicationTemplate)
  })

  test("never deletes a system-bound template", async () => {
    const { context } = createTestContext()
    const result = await new DeleteApplicationTemplate(context).run({
      session: makeTestSession("root"),
      code: "personnel_action_request",
    })
    expectApplicationError(result, ConflictError, "system_template_locked")
  })
})
