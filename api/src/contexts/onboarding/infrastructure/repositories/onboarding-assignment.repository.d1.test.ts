import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import { OnboardingTemplateTask } from "@/contexts/onboarding/domain/entities/onboarding-template-task.entity"
import { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["reassign-and-cancel"] })
})

afterAll(async () => {
  await local.dispose()
})

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

function assign(assignedAt: string): OnboardingAssignment {
  return OnboardingAssignment.create({ employeeId: toWorkforceEmployeeId(1), template, assignedAt })
}

describe("OnboardingAssignmentRepository on local D1", () => {
  test("only one active assignment per template, reassignable after completion, cancel removes tasks", async () => {
    const { context, db } = await createLocalD1Context(local, "reassign-and-cancel")

    const repository = new OnboardingAssignmentRepository(context)

    const first = await repository.create(assign("2026-05-01T00:00:00.000Z"))

    if (first instanceof Error || first.id === null) throw new Error("create failed")

    const active = await repository.findActiveByEmployeeAndTemplate(
      toWorkforceEmployeeId(1),
      "join-default",
    )

    expect(active instanceof OnboardingAssignment ? active.id : active).toBe(first.id)
    expect(await repository.create(assign("2026-05-02T00:00:00.000Z"))).toBeInstanceOf(
      UniqueConstraintError,
    )

    const completed = await repository.update(first.updateStatus("completed"))

    if (completed instanceof Error) throw completed

    expect(
      await repository.findActiveByEmployeeAndTemplate(toWorkforceEmployeeId(1), "join-default"),
    ).toBeNull()
    expect(await repository.delete(completed)).toBeNull()

    const second = await repository.create(assign("2026-06-01T00:00:00.000Z"))

    if (second instanceof Error || second.id === null) throw new Error("reassign failed")

    expect(await repository.delete(second)).toBe(true)
    expect(await repository.findById(second.id)).toBeNull()

    const remainingTasks = await db
      .prepare("SELECT count(*) AS count FROM onboarding_tasks WHERE assignment_id = ?1")
      .bind(second.id)
      .first<number>("count")

    expect(remainingTasks).toBe(0)
  })
})
