import { CreateApplicationTemplate } from "@/application/application/create-application-template"
import { DeleteApplicationTemplate } from "@/application/application/delete-application-template"
import { UpdateApplicationTemplate } from "@/application/application/update-application-template"
import { ApplicationTemplate } from "@/domain/application/application-template"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
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

describe("CreateApplicationTemplate", () => {
  test("a privileged role creates a template", async () => {
    const { context } = createTestContext()

    const result = await new CreateApplicationTemplate(context).run({
      viewerRole: "admin",
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
      viewerRole: "member",
      code: "leave",
      name: "休暇申請",
      category: "attendance",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    if (result instanceof Error || result instanceof ApplicationTemplate) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("forbidden")
  })

  test("a duplicate code conflicts", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new CreateApplicationTemplate(context).run({
      viewerRole: "admin",
      code: "expense",
      name: "別の経費申請",
      category: "expense",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    if (result instanceof Error || result instanceof ApplicationTemplate) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("template_code_conflict")
  })
})

describe("UpdateApplicationTemplate", () => {
  test("a privileged role updates a template", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new UpdateApplicationTemplate(context).run({
      viewerRole: "admin",
      code: "expense",
      name: "経費精算",
      category: "accounting",
      description: "更新",
      schemaJson: { type: "object" },
      approverRoles: ["admin"],
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
      viewerRole: "member",
      code: "expense",
      name: "X",
      category: "expense",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    if (result instanceof Error || result instanceof ApplicationTemplate) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("forbidden")
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateApplicationTemplate(context).run({
      viewerRole: "admin",
      code: "missing",
      name: "X",
      category: "general",
      description: null,
      schemaJson: {},
      approverRoles: [],
    })

    if (result instanceof Error || result instanceof ApplicationTemplate) {
      throw new Error("expected a reason result")
    }

    expect(result.reason).toBe("template_not_found")
  })
})

describe("DeleteApplicationTemplate", () => {
  test("a privileged role deletes a template", async () => {
    const { context, db } = createTestContext()

    await seedExpense(db)

    const result = await new DeleteApplicationTemplate(context).run({
      viewerRole: "admin",
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
      viewerRole: "member",
      code: "expense",
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("forbidden")
  })

  test("an unknown code is not found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteApplicationTemplate(context).run({
      viewerRole: "admin",
      code: "missing",
    })

    if (result instanceof Error) {
      throw result
    }

    expect(result.reason).toBe("template_not_found")
  })
})
