import { Application } from "@/domain/application/application"
import { ApplicationApproval } from "@/domain/application/application-approval"
import { ApplicationRepository } from "@/infrastructure/application/application-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("ApplicationRepository", () => {
  test("create then findById round-trips the application", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await repository.create(
      Application.create({
        templateId: 1,
        applicantId: 1,
        currentStep: "manager",
        payload: { reason: "テスト" },
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(Application)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(Application)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.status).toBe("pending")
    expect(found.currentStep).toBe("manager")
  })

  test("update persists the status change", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const created = await repository.create(
      Application.create({
        templateId: 1,
        applicantId: 1,
        currentStep: "manager",
        payload: {},
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(created.withStatus("approved"))

    expect(updated).toBeInstanceOf(Application)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("approved")
  })

  test("addApproval persists an approval record for the application", async () => {
    const { context } = createTestContext()

    const repository = new ApplicationRepository(context)

    const approval = await repository.addApproval(
      ApplicationApproval.create({
        applicationId: 1,
        approverId: 2,
        action: "approve",
        comment: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(approval).toBeInstanceOf(ApplicationApproval)

    if (approval instanceof Error) {
      throw approval
    }

    expect(approval.action).toBe("approve")
  })
})
