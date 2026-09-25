import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import { AssignOnboarding } from "@/contexts/onboarding/application/assign-onboarding"
import { CancelOnboardingAssignment } from "@/contexts/onboarding/application/cancel-onboarding-assignment"
import { CompleteOnboardingTask } from "@/contexts/onboarding/application/complete-onboarding-task"
import { UncompleteOnboardingTask } from "@/contexts/onboarding/application/uncomplete-onboarding-task"
import { UpdateOnboardingAssignment } from "@/contexts/onboarding/application/update-onboarding-assignment"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/contexts/onboarding/domain/entities/onboarding-template-task.entity"
import {
  createFakeAssignmentRepository,
  createFakeEmployeeDirectory,
  createFakeTemplateRepository,
} from "@/contexts/onboarding/test/onboarding-repository-fakes.test-support"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { ApplicationError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { describe, expect, test } from "bun:test"

const template = new OnboardingTemplate({
  id: "0190003c-0000-7000-8000-000000000001",
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

const employeeId = 10_000

function directoryEntry(id: number, code: string): CompanyEmployeeDirectoryEntry {
  return {
    id: toWorkforceEmployeeId(id),
    officialName: "You",
    employeeCode: code,
    email: null,
    phone: null,
    employment: null,
    primaryAssignment: null,
  }
}

/** 従業員名簿、テンプレート、割り当てを型付きfakeにして、DBなしで業務判断を検証する。 */
function createAssignmentTestContext() {
  const templateRepository = createFakeTemplateRepository()

  templateRepository.templates.set(template.code, template)

  return {
    employeeDirectory: createFakeEmployeeDirectory([directoryEntry(employeeId, "E201")]),
    templateRepository,
    assignmentRepository: createFakeAssignmentRepository(),
  }
}

type AssignmentTestContext = ReturnType<typeof createAssignmentTestContext>

async function seedAssignment(context: AssignmentTestContext): Promise<OnboardingAssignment> {
  const created = await context.assignmentRepository.create(
    OnboardingAssignment.create({
      employeeId: toWorkforceEmployeeId(employeeId),
      template,
      assignedAt: "2026-05-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created.id === null) {
    throw new Error("seed assignment failed")
  }

  return created
}

function firstTaskId(assignment: OnboardingAssignment): string {
  const taskId = assignment.tasks[0]?.id

  if (taskId === null || taskId === undefined) {
    throw new Error("missing task id")
  }

  return taskId
}

describe("GetOnboardingAssignment", () => {})

describe("UpdateOnboardingAssignment", () => {
  test("a privileged role reschedules the assignment", async () => {
    const context = createAssignmentTestContext()

    const assignment = await seedAssignment(context)

    const result = await new UpdateOnboardingAssignment(context).run({
      assignmentId: assignment.id ?? "",
      session: makeTestSession("hr"),
      assignedAt: "2026-06-15T00:00:00.000Z",
    })

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.assignment.assignedAt).toBe("2026-06-15T00:00:00.000Z")
    expect(result.employee.employeeCode).toBe("E201")
  })

  test("a member is forbidden", async () => {
    const context = createAssignmentTestContext()

    const assignment = await seedAssignment(context)

    const result = await new UpdateOnboardingAssignment(context).run({
      assignmentId: assignment.id ?? "",
      session: makeTestSession("member"),
      assignedAt: "2026-06-15T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("CancelOnboardingAssignment", () => {
  test("a privileged role deletes the assignment", async () => {
    const context = createAssignmentTestContext()

    const assignment = await seedAssignment(context)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId: assignment.id ?? "",
      session: makeTestSession("root"),
    })

    expect(result).toEqual({ reason: "cancelled" })

    const found = await context.assignmentRepository.findById(assignment.id ?? "")

    expect(found).toBeNull()
  })

  test("a completed assignment is not modifiable", async () => {
    const context = createAssignmentTestContext()

    const assignment = await seedAssignment(context)

    await context.assignmentRepository.update(assignment.updateStatus("completed"))

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId: assignment.id ?? "",
      session: makeTestSession("root"),
    })

    expectApplicationError(result, ConflictError, "not_modifiable")
  })

  test("a member is forbidden", async () => {
    const context = createAssignmentTestContext()

    const assignment = await seedAssignment(context)

    const result = await new CancelOnboardingAssignment(context).run({
      assignmentId: assignment.id ?? "",
      session: makeTestSession("member"),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("UncompleteOnboardingTask", () => {
  test("the owner reverts a completed task to pending", async () => {
    const context = createAssignmentTestContext()

    const taskId = firstTaskId(await seedAssignment(context))

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
    const context = createAssignmentTestContext()

    const taskId = firstTaskId(await seedAssignment(context))

    const result = await new UncompleteOnboardingTask(context).run({
      taskId,
      session: makeTestSession("member", employeeId + 999),
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("an unknown task is not found", async () => {
    const context = createAssignmentTestContext()

    const result = await new UncompleteOnboardingTask(context).run({
      taskId: "0190003e-0000-7000-8000-00000000270f",
      session: makeTestSession("root", 1),
    })

    expectApplicationError(result, NotFoundError, "task_not_found")
  })
})

describe("AssignOnboarding duplicate check", () => {
  test("assigning the same template twice returns already_assigned", async () => {
    const context = createAssignmentTestContext()

    const firstResult = await new AssignOnboarding(context).run({
      session: makeTestSession("hr"),
      employeeCode: "E201",
      templateCode: template.code,
      assignedAt: "2026-05-01T00:00:00.000Z",
    })

    if (firstResult instanceof ApplicationError) {
      throw new Error("first assignment failed")
    }

    expect(firstResult.tasks.map((task) => task.templateTaskCode)).toEqual(["account", "pc"])

    const secondResult = await new AssignOnboarding(context).run({
      session: makeTestSession("hr"),
      employeeCode: "E201",
      templateCode: template.code,
      assignedAt: "2026-05-02T00:00:00.000Z",
    })

    expectApplicationError(secondResult, ConflictError, "already_assigned")
  })

  test("a unique constraint race on create returns already_assigned", async () => {
    const context = createAssignmentTestContext()

    const result = await new AssignOnboarding({
      ...context,
      assignmentRepository: {
        findActiveByEmployeeAndTemplate: async () => null,
        create: async () => new UniqueConstraintError("onboarding assignment already exists"),
      },
    }).run({
      session: makeTestSession("hr"),
      employeeCode: "E201",
      templateCode: template.code,
      assignedAt: "2026-05-01T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_assigned")
  })

  test("allows assigning after the previous assignment is completed", async () => {
    const context = createAssignmentTestContext()

    const firstAssignment = await seedAssignment(context)

    await context.assignmentRepository.update(firstAssignment.updateStatus("completed"))

    const secondResult = await new AssignOnboarding(context).run({
      session: makeTestSession("hr"),
      employeeCode: "E201",
      templateCode: template.code,
      assignedAt: "2026-06-01T00:00:00.000Z",
    })

    expect(secondResult instanceof ApplicationError).toBe(false)
  })
})
