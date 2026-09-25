import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { OnboardingAssignment } from "@/contexts/onboarding/domain/entities/onboarding-assignment.entity"
import { OnboardingTask } from "@/contexts/onboarding/domain/entities/onboarding-task.entity"
import { OnboardingTemplate } from "@/contexts/onboarding/domain/entities/onboarding-template.entity"
import type { OnboardingAssignmentRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-assignment.repository"
import type { OnboardingTemplateRepository } from "@/contexts/onboarding/infrastructure/repositories/onboarding-template.repository"

type TemplateRepositoryPort = Pick<
  OnboardingTemplateRepository,
  "findByCode" | "create" | "update" | "delete"
>

type AssignmentRepositoryPort = Pick<
  OnboardingAssignmentRepository,
  | "findById"
  | "findByTaskId"
  | "findActiveByEmployeeAndTemplate"
  | "countActiveByTemplateCode"
  | "create"
  | "update"
  | "completeTask"
  | "uncompleteTask"
  | "delete"
>

/**
 * OnboardingTemplateRepository の型付きfake。Domain model を保持するだけで、SQLやD1を模倣しない。
 * lifecycle binding と in_progress 割り当てによる条件付き更新・削除の SQL は
 * onboarding-template.repository.d1.test.ts がローカルD1で検証する。
 */
export function createFakeTemplateRepository(
  options: { lifecycleBoundCodes?: ReadonlyArray<string> } = {},
): TemplateRepositoryPort & { templates: Map<string, OnboardingTemplate> } {
  const templates = new Map<string, OnboardingTemplate>()

  const bound = new Set(options.lifecycleBoundCodes ?? [])

  return {
    templates,
    findByCode: async (code) => templates.get(code) ?? null,
    create: async (template) => {
      const created = new OnboardingTemplate({
        id: crypto.randomUUID(),
        code: template.code,
        name: template.name,
        kind: template.kind,
        description: template.description,
        tasks: template.tasks,
      })
      templates.set(created.code, created)
      return created
    },
    update: async (template) => {
      const current = templates.get(template.code)
      if (current === undefined) return null
      if (current.kind !== template.kind && bound.has(template.code)) return null
      templates.set(template.code, template)
      return template
    },
    delete: async (template) => {
      if (bound.has(template.code)) return null
      templates.delete(template.code)
      return true
    },
  }
}

/** OnboardingAssignmentRepository の型付きfake。taskのidを採番し、完了状態を Domain model で再計算する。 */
export function createFakeAssignmentRepository(): AssignmentRepositoryPort & {
  assignments: Map<string, OnboardingAssignment>
} {
  const assignments = new Map<string, OnboardingAssignment>()

  const findByTaskId = async (taskId: string) =>
    [...assignments.values()].find((assignment) =>
      assignment.tasks.some((task) => task.id === taskId),
    ) ?? null

  const replace = (assignment: OnboardingAssignment) => {
    if (assignment.id !== null) assignments.set(assignment.id, assignment)
    return assignment
  }

  return {
    assignments,
    findById: async (id) => assignments.get(id) ?? null,
    findByTaskId,
    findActiveByEmployeeAndTemplate: async (employeeId, templateCode) =>
      [...assignments.values()].find(
        (assignment) =>
          assignment.employeeId === employeeId &&
          assignment.templateCode === templateCode &&
          assignment.status !== "completed",
      ) ?? null,
    countActiveByTemplateCode: async (templateCode) =>
      [...assignments.values()].filter(
        (assignment) =>
          assignment.templateCode === templateCode && assignment.status === "in_progress",
      ).length,
    create: async (assignment) => {
      const id = crypto.randomUUID()
      const tasks = assignment.tasks.map((task) => {
        const taskId = crypto.randomUUID()
        return new OnboardingTask({
          id: taskId,
          assignmentId: id,
          templateTaskCode: task.templateTaskCode,
          title: task.title,
          order: task.order,
          status: task.status,
          completedAt: task.completedAt,
        })
      })
      return replace(
        new OnboardingAssignment({
          id,
          employeeId: assignment.employeeId,
          templateCode: assignment.templateCode,
          kind: assignment.kind,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          tasks,
        }),
      )
    },
    update: async (assignment) => replace(assignment),
    completeTask: async (taskId, assignmentId, completedAt) => {
      const current = assignments.get(assignmentId)
      const task = current?.tasks.find((candidate) => candidate.id === taskId)
      if (current === undefined || task === undefined || task.status === "done") return null
      return replace(current.completeTask(taskId, completedAt))
    },
    uncompleteTask: async (taskId, assignmentId) => {
      const current = assignments.get(assignmentId)
      const task = current?.tasks.find((candidate) => candidate.id === taskId)
      if (current === undefined || task === undefined || task.status === "pending") return null
      return replace(current.uncompleteTask(taskId))
    },
    delete: async (assignment) => {
      if (assignment.id === null) return new Error("cannot delete unsaved onboarding assignment")
      const current = assignments.get(assignment.id)
      if (current === undefined || current.status !== "in_progress") return null
      assignments.delete(assignment.id)
      return true
    },
  }
}

/** Company の従業員名簿の型付きfake。 */
export function createFakeEmployeeDirectory(
  entries: ReadonlyArray<CompanyEmployeeDirectoryEntry>,
): Pick<CompanyEmployeeDirectory, "findById" | "findByCode"> {
  return {
    findById: async (id: EmployeeId) => entries.find((entry) => entry.id === id) ?? null,
    findByCode: async (code: string) =>
      entries.find((entry) => entry.employeeCode === code) ?? null,
  }
}
