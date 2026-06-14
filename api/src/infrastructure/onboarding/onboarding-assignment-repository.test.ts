import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/domain/onboarding/onboarding-template-task.entity"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("OnboardingAssignmentRepository", () => {
  test("create then findById round-trips the assignment with its tasks", async () => {
    const { context } = createTestContext()

    const template = new OnboardingTemplate({
      id: 1,
      code: "join-default",
      name: "入社手続き",
      kind: "join",
      description: null,
      tasks: [
        new OnboardingTemplateTask({
          code: "account",
          title: "アカウント発行",
          order: 1,
          ownerRole: null,
        }),
      ],
    })

    const repository = new OnboardingAssignmentRepository(context)

    const created = await repository.create(
      OnboardingAssignment.create({
        employeeId: 1,
        template,
        assignedAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(OnboardingAssignment)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(OnboardingAssignment)

    if (found === null || found instanceof Error) {
      throw found ?? new Error("not found")
    }

    expect(found.templateCode).toBe("join-default")
    expect(found.status).toBe("in_progress")
    expect(found.tasks.length).toBe(1)
    expect(found.tasks[0]?.title).toBe("アカウント発行")
  })
})
