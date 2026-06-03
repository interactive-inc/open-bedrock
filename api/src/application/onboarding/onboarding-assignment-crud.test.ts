import { CancelOnboardingAssignment } from "@/application/onboarding/cancel-onboarding-assignment"
import { CompleteOnboardingTask } from "@/application/onboarding/complete-onboarding-task"
import { GetOnboardingAssignment } from "@/application/onboarding/get-onboarding-assignment"
import { UncompleteOnboardingTask } from "@/application/onboarding/uncomplete-onboarding-task"
import { UpdateOnboardingAssignment } from "@/application/onboarding/update-onboarding-assignment"
import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment"
import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template"
import { OnboardingTemplateTask } from "@/domain/onboarding/onboarding-template-task"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { employees } from "@/schema"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

let nextEmployeeId = 1

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
    new OnboardingTemplateTask({ code: "pc", title: "PC貸与", order: 2, ownerRole: null }),
  ],
})

async function seedEmployee(context: Context, code: string): Promise<number> {
  const id = nextEmployeeId

  nextEmployeeId += 1

  await context.var.database.insert(employees).values({
    id,
    code,
    name: "You",
    email: `you+${code}@example.com`,
    passwordHash: "x",
    role: "member",
    deptId: 1,
    deptName: "Dept",
    position: "Staff",
    status: "active",
  })

  return id
}

async function seedAssignment(context: Context, employeeId: number): Promise<number> {
  const repository = new OnboardingAssignmentRepository(context)

  const created = await repository.create(
    OnboardingAssignment.create({
      employeeId,
      template,
      assignedAt: "2026-05-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed assignment failed")
  }

  return created.id
}

describe("GetOnboardingAssignment", () => {
  test("the owner reads their own assignment", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E101")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new GetOnboardingAssignment(context).run({
      assignmentId,
      viewerEmployeeId: employeeId,
      viewerRole: "member",
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("get failed")
    }

    expect(result.assignment.id).toBe(assignmentId)
    expect(result.employee.code).toBe("E101")
  })

  test("a non-owner member is forbidden", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E102")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new GetOnboardingAssignment(context).run({
      assignmentId,
      viewerEmployeeId: employeeId + 999,
      viewerRole: "member",
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("an unknown assignment is not found", async () => {
    const { context } = createTestContext()

    const result = await new GetOnboardingAssignment(context).run({
      assignmentId: 9999,
      viewerEmployeeId: 1,
      viewerRole: "admin",
    })

    expect(result).toEqual({ reason: "assignment_not_found" })
  })
})

describe("UpdateOnboardingAssignment", () => {
  test("a privileged role reschedules the assignment", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E103")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new UpdateOnboardingAssignment(context).run({
      assignmentId,
      viewerRole: "hr",
      assignedAt: "2026-06-15T00:00:00.000Z",
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.assignment.assignedAt).toBe("2026-06-15T00:00:00.000Z")
  })

  test("a member is forbidden", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E104")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new UpdateOnboardingAssignment(context).run({
      assignmentId,
      viewerRole: "member",
      assignedAt: "2026-06-15T00:00:00.000Z",
    })

    expect(result).toEqual({ reason: "forbidden" })
  })
})

describe("CancelOnboardingAssignment", () => {
  test("a privileged role deletes the assignment and its tasks", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E105")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId,
      viewerRole: "admin",
    })

    expect(result).toEqual({ reason: "cancelled" })

    const repository = new OnboardingAssignmentRepository(context)

    const found = await repository.findById(assignmentId)

    expect(found).toBeInstanceOf(Error)
  })

  test("a member is forbidden", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E106")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId,
      viewerRole: "member",
    })

    expect(result).toEqual({ reason: "forbidden" })
  })
})

describe("UncompleteOnboardingTask", () => {
  test("the owner reverts a completed task to pending", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E107")

    const assignmentId = await seedAssignment(context, employeeId)

    const repository = new OnboardingAssignmentRepository(context)

    const assignment = await repository.findById(assignmentId)

    if (assignment instanceof Error) {
      throw assignment
    }

    const taskId = assignment.tasks[0]?.id

    if (taskId === null || taskId === undefined) {
      throw new Error("missing task id")
    }

    await new CompleteOnboardingTask(context).run({
      taskId,
      viewerEmployeeId: employeeId,
      viewerRole: "member",
      completedAt: "2026-06-01T00:00:00.000Z",
    })

    const result = await new UncompleteOnboardingTask(context).run({
      taskId,
      viewerEmployeeId: employeeId,
      viewerRole: "member",
    })

    if (result instanceof Error || "reason" in result) {
      throw new Error("uncomplete failed")
    }

    expect(result.status).toBe("pending")
    expect(result.completedAt).toBe(null)
  })

  test("a non-owner member is forbidden", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E108")

    const assignmentId = await seedAssignment(context, employeeId)

    const repository = new OnboardingAssignmentRepository(context)

    const assignment = await repository.findById(assignmentId)

    if (assignment instanceof Error) {
      throw assignment
    }

    const taskId = assignment.tasks[0]?.id

    if (taskId === null || taskId === undefined) {
      throw new Error("missing task id")
    }

    const result = await new UncompleteOnboardingTask(context).run({
      taskId,
      viewerEmployeeId: employeeId + 999,
      viewerRole: "member",
    })

    expect(result).toEqual({ reason: "forbidden" })
  })

  test("an unknown task is not found", async () => {
    const { context } = createTestContext()

    const result = await new UncompleteOnboardingTask(context).run({
      taskId: 9999,
      viewerEmployeeId: 1,
      viewerRole: "admin",
    })

    expect(result).toEqual({ reason: "task_not_found" })
  })
})
