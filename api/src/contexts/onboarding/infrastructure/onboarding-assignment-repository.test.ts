import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/contexts/onboarding/domain/entities/onboarding-template-task.entity"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/onboarding-assignment.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

function twoTaskTemplate(): OnboardingTemplate {
  return new OnboardingTemplate({
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
      new OnboardingTemplateTask({
        code: "laptop",
        title: "PC 配布",
        order: 2,
        ownerRole: null,
      }),
    ],
  })
}

async function createTwoTaskAssignment(
  repository: OnboardingAssignmentRepository,
): Promise<OnboardingAssignment> {
  const created = await repository.create(
    OnboardingAssignment.create({
      employeeId: 1,
      template: twoTaskTemplate(),
      assignedAt: "2026-01-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("create failed")
  }

  return created
}

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

  test("completeTask marks a single task done and keeps others unchanged", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    const result = await repository.completeTask(task1.id!, assignment.id!, "2026-06-01T00:00:00Z")

    expect(result).toBeInstanceOf(OnboardingAssignment)

    if (result === null || result instanceof Error) {
      throw result ?? new Error("unexpected null")
    }

    const t1 = result.tasks.find((t) => t.id === task1.id)
    const t2 = result.tasks.find((t) => t.id !== task1.id)

    expect(t1?.status).toBe("done")
    expect(t1?.completedAt).toBe("2026-06-01T00:00:00Z")
    expect(t2?.status).toBe("pending")
    expect(result.status).toBe("in_progress")
  })

  test("completing all tasks flips assignment to completed", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    const task2 = assignment.tasks[1]!

    await repository.completeTask(task1.id!, assignment.id!, "2026-06-01T00:00:00Z")
    const result = await repository.completeTask(task2.id!, assignment.id!, "2026-06-01T00:00:00Z")

    expect(result).toBeInstanceOf(OnboardingAssignment)

    if (result === null || result instanceof Error) {
      throw result ?? new Error("unexpected null")
    }

    expect(result.status).toBe("completed")
    expect(result.tasks.every((t) => t.status === "done")).toBe(true)
  })

  test("completeTask returns null when the task is already done", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    await repository.completeTask(task1.id!, assignment.id!, "2026-06-01T00:00:00Z")

    const duplicate = await repository.completeTask(
      task1.id!,
      assignment.id!,
      "2026-06-02T00:00:00Z",
    )

    expect(duplicate).toBeNull()
  })

  test("concurrent completions of different tasks do not overwrite each other", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    const task2 = assignment.tasks[1]!

    // Simulate two users reading the same snapshot, then completing different tasks.
    // With the old update() method this would cause a lost update because each
    // write replays all tasks from a stale snapshot. The new completeTask() only
    // touches the single target row, so both writes succeed independently.
    const [r1, r2] = await Promise.all([
      repository.completeTask(task1.id!, assignment.id!, "2026-06-01T00:00:00Z"),
      repository.completeTask(task2.id!, assignment.id!, "2026-06-01T00:00:00Z"),
    ])

    // Both should succeed (neither returns null).
    expect(r1).toBeInstanceOf(OnboardingAssignment)
    expect(r2).toBeInstanceOf(OnboardingAssignment)

    // Re-read to verify the final state.
    const final = await repository.findById(assignment.id!)

    if (final === null || final instanceof Error) {
      throw final ?? new Error("not found")
    }

    expect(final.tasks.every((t) => t.status === "done")).toBe(true)
    expect(final.status).toBe("completed")
  })

  test("uncompleteTask reverts a done task to pending", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    await repository.completeTask(task1.id!, assignment.id!, "2026-06-01T00:00:00Z")

    const result = await repository.uncompleteTask(task1.id!, assignment.id!)

    expect(result).toBeInstanceOf(OnboardingAssignment)

    if (result === null || result instanceof Error) {
      throw result ?? new Error("unexpected null")
    }

    const reverted = result.tasks.find((t) => t.id === task1.id)

    expect(reverted?.status).toBe("pending")
    expect(reverted?.completedAt).toBeNull()
    expect(result.status).toBe("in_progress")
  })

  test("uncompleteTask returns null when the task is already pending", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    const result = await repository.uncompleteTask(task1.id!, assignment.id!)

    expect(result).toBeNull()
  })

  test("uncompleting a task reverts a completed assignment to in_progress", async () => {
    const { context } = createTestContext()
    const repository = new OnboardingAssignmentRepository(context)
    const assignment = await createTwoTaskAssignment(repository)

    const task1 = assignment.tasks[0]!
    const task2 = assignment.tasks[1]!

    await repository.completeTask(task1.id!, assignment.id!, "2026-06-01T00:00:00Z")
    await repository.completeTask(task2.id!, assignment.id!, "2026-06-01T00:00:00Z")

    const result = await repository.uncompleteTask(task1.id!, assignment.id!)

    expect(result).toBeInstanceOf(OnboardingAssignment)

    if (result === null || result instanceof Error) {
      throw result ?? new Error("unexpected null")
    }

    expect(result.status).toBe("in_progress")
  })
})
