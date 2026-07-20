import { ApplicationTemplate } from "@/domain/application/application-template.entity"
import { ApplicationTemplateRepository } from "@/infrastructure/application/application-template-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { describe, expect, test } from "bun:test"

describe("ApplicationTemplateRepository", () => {
  test("findByCode returns a seeded template", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "application_templates", [
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

    const repository = new ApplicationTemplateRepository(context)

    const found = await repository.findByCode("expense")

    expect(found).toBeInstanceOf(ApplicationTemplate)

    if (found instanceof Error || found === null) {
      throw new Error("findByCode failed")
    }

    expect(found.code).toBe("expense")
  })

  test("findByCode returns null for an unknown code", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationTemplateRepository(context)

    const found = await repository.findByCode("unknown")

    expect(found).toBeNull()
  })

  test("create inserts a template and assigns an id", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationTemplateRepository(context)

    const created = await repository.create(
      ApplicationTemplate.create({
        code: "leave",
        name: "休暇申請",
        category: "attendance",
        description: null,
        schemaJson: { type: "object" },
        approverRoles: ["manager"],
      }),
    )

    expect(created).toBeInstanceOf(ApplicationTemplate)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.id).not.toBeNull()
    expect(created.code).toBe("leave")
  })

  test("update changes the content keyed by code", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "application_templates", [
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

    const repository = new ApplicationTemplateRepository(context)

    const current = await repository.findByCode("expense")

    if (current instanceof Error || current === null) {
      throw new Error("findByCode failed")
    }

    const updated = await repository.update(
      current.withDetails({
        name: "経費精算",
        category: "accounting",
        description: "更新",
        schemaJson: { type: "object" },
        approverRoles: ["admin"],
      }),
    )

    expect(updated).toBeInstanceOf(ApplicationTemplate)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.name).toBe("経費精算")
    expect(updated.approverRoles).toEqual(["admin"])
  })

  test("delete removes the template", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "application_templates", [
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

    const repository = new ApplicationTemplateRepository(context)

    const deleted = await repository.delete("expense")

    expect(deleted).toBe(true)

    const found = await repository.findByCode("expense")

    expect(found).toBeNull()
  })

  test("delete returns null when pending applications exist", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "application_templates", [
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

    await seedD1(db, "applications", [
      {
        id: 1,
        template_id: 1,
        applicant_id: 1,
        status: "pending",
        current_step: null,
        payload: "{}",
        created_at: "2024-01-01T00:00:00Z",
      },
    ])

    const repository = new ApplicationTemplateRepository(context)

    const deleted = await repository.delete("expense")

    expect(deleted).toBeNull()

    // テンプレートが残存していることを確認
    const found = await repository.findByCode("expense")

    expect(found).toBeInstanceOf(ApplicationTemplate)
  })

  test("delete returns null when a decided (approved) application references it", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "application_templates", [
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

    await seedD1(db, "applications", [
      {
        id: 1,
        template_id: 1,
        applicant_id: 1,
        status: "approved",
        current_step: null,
        payload: "{}",
        created_at: "2024-01-01T00:00:00Z",
      },
    ])

    const repository = new ApplicationTemplateRepository(context)

    const deleted = await repository.delete("expense")

    expect(deleted).toBeNull()

    const found = await repository.findByCode("expense")

    expect(found).toBeInstanceOf(ApplicationTemplate)
  })
})
