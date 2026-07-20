import { AssignOnboarding } from "@/application/onboarding/assign-onboarding"
import { CancelOnboardingAssignment } from "@/application/onboarding/cancel-onboarding-assignment"
import { CompleteOnboardingTask } from "@/application/onboarding/complete-onboarding-task"
import { GetOnboardingAssignment } from "@/application/onboarding/get-onboarding-assignment"
import { UncompleteOnboardingTask } from "@/application/onboarding/uncomplete-onboarding-task"
import { UpdateOnboardingAssignment } from "@/application/onboarding/update-onboarding-assignment"
import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/domain/onboarding/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/domain/onboarding/onboarding-template-task.entity"
import type { Context } from "@/env"
import { OnboardingAssignmentRepository } from "@/infrastructure/onboarding/onboarding-assignment-repository"
import { ApplicationError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { employees, onboardingTasks } from "@/schema"
import { eq } from "drizzle-orm"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
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
      session: makeTestSession("member"),
    })

    if (result instanceof ApplicationError) {
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
      session: makeTestSession("member"),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("an unknown assignment is not found", async () => {
    const { context } = createTestContext()

    const result = await new GetOnboardingAssignment(context).run({
      assignmentId: 9999,
      viewerEmployeeId: 1,
      session: makeTestSession("admin"),
    })

    expectApplicationError(result, NotFoundError, "assignment_not_found")
  })
})

describe("UpdateOnboardingAssignment", () => {
  test("a privileged role reschedules the assignment", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E103")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new UpdateOnboardingAssignment(context).run({
      assignmentId,
      session: makeTestSession("hr"),
      assignedAt: "2026-06-15T00:00:00.000Z",
    })

    if (result instanceof ApplicationError) {
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
      session: makeTestSession("member"),
      assignedAt: "2026-06-15T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("CancelOnboardingAssignment", () => {
  test("a privileged role deletes the assignment and its tasks", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E105")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId,
      session: makeTestSession("admin"),
    })

    expect(result).toEqual({ reason: "cancelled" })

    const repository = new OnboardingAssignmentRepository(context)

    const found = await repository.findById(assignmentId)

    expect(found).toBeNull()
  })

  test("cancel removes orphaned onboarding_tasks for the assignment", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E105B")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId,
      session: makeTestSession("admin"),
    })

    expect(result).toEqual({ reason: "cancelled" })

    const remainingTasks = await context.var.database
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.assignmentId, assignmentId))

    expect(remainingTasks.length).toBe(0)
  })

  test("a member is forbidden", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E106")

    const assignmentId = await seedAssignment(context, employeeId)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId,
      session: makeTestSession("member"),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("UncompleteOnboardingTask", () => {
  test("the owner reverts a completed task to pending", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E107")

    const assignmentId = await seedAssignment(context, employeeId)

    const repository = new OnboardingAssignmentRepository(context)

    const assignment = await repository.findById(assignmentId)

    if (assignment === null || assignment instanceof Error) {
      throw assignment ?? new Error("assignment not found")
    }

    const taskId = assignment.tasks[0]?.id

    if (taskId === null || taskId === undefined) {
      throw new Error("missing task id")
    }

    await new CompleteOnboardingTask(context).run({
      taskId,
      session: makeTestSession("member", employeeId),
      completedAt: "2026-06-01T00:00:00.000Z",
    })

    const result = await new UncompleteOnboardingTask(context).run({
      taskId,
      session: makeTestSession("member", employeeId),
    })

    if (result instanceof ApplicationError) {
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

    if (assignment === null || assignment instanceof Error) {
      throw assignment ?? new Error("assignment not found")
    }

    const taskId = assignment.tasks[0]?.id

    if (taskId === null || taskId === undefined) {
      throw new Error("missing task id")
    }

    const result = await new UncompleteOnboardingTask(context).run({
      taskId,
      session: makeTestSession("member", employeeId + 999),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("an unknown task is not found", async () => {
    const { context } = createTestContext()

    const result = await new UncompleteOnboardingTask(context).run({
      taskId: 9999,
      session: makeTestSession("admin", 1),
    })

    expectApplicationError(result, NotFoundError, "task_not_found")
  })
})

async function seedTemplate(context: Context): Promise<void> {
  const { onboardingTemplates: tbl, onboardingTemplateTasks: ttbl } = await import("@/schema")

  await context.var.database.insert(tbl).values({
    id: template.id ?? undefined,
    code: template.code,
    name: template.name,
    kind: template.kind,
    description: template.description,
  })

  for (const task of template.tasks) {
    await context.var.database.insert(ttbl).values({
      templateCode: template.code,
      code: task.code,
      title: task.title,
      sortOrder: task.order,
      ownerRole: task.ownerRole,
    })
  }
}

describe("AssignOnboarding duplicate check", () => {
  test("assigning the same template twice returns already_assigned", async () => {
    const { context } = createTestContext()

    await seedEmployee(context, "E201")
    await seedTemplate(context)

    const firstResult = await new AssignOnboarding(context).run({
      session: makeTestSession("hr"),
      employeeCode: "E201",
      templateCode: template.code,
      assignedAt: "2026-05-01T00:00:00.000Z",
    })

    if (firstResult instanceof ApplicationError) {
      throw new Error("first assignment failed")
    }

    const secondResult = await new AssignOnboarding(context).run({
      session: makeTestSession("hr"),
      employeeCode: "E201",
      templateCode: template.code,
      assignedAt: "2026-05-02T00:00:00.000Z",
    })

    expectApplicationError(secondResult, ConflictError, "already_assigned")
  })

  test("allows assigning after the previous assignment is completed", async () => {
    const { context } = createTestContext()

    const employeeId = await seedEmployee(context, "E202")
    await seedTemplate(context)

    const firstAssignmentId = await seedAssignment(context, employeeId)

    // manually mark the assignment as completed
    const repository = new OnboardingAssignmentRepository(context)

    const firstAssignment = await repository.findById(firstAssignmentId)

    if (firstAssignment === null || firstAssignment instanceof Error) {
      throw new Error("seed assignment not found")
    }

    await repository.update(firstAssignment.updateStatus("completed"))

    const secondResult = await new AssignOnboarding(context).run({
      session: makeTestSession("hr"),
      employeeCode: "E202",
      templateCode: template.code,
      assignedAt: "2026-06-01T00:00:00.000Z",
    })

    expect(secondResult instanceof ApplicationError).toBe(false)
  })
})
