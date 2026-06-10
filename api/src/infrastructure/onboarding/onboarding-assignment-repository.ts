import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment"
import { OnboardingTask } from "@/domain/onboarding/onboarding-task"
import type { Context } from "@/env"
import { onboardingAssignments, onboardingTasks } from "@/schema"
import { asc, eq, inArray } from "drizzle-orm"

export class OnboardingAssignmentRepository {
  constructor(private readonly c: Context) {}

  // assignment INSERT + 全タスク INSERT を D1 batch で 1 トランザクションにまとめる。
  // タスクの assignment_id は MAX(id) サブクエリで参照し、アプリ側で id を受け渡す必要をなくす。
  async create(assignment: OnboardingAssignment): Promise<OnboardingAssignment | Error> {
    try {
      const assignmentStmt = this.c.env.DB.prepare(
        `INSERT INTO onboarding_assignments (employee_id, template_code, kind, status, assigned_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         RETURNING id, employee_id, template_code, kind, status, assigned_at`,
      ).bind(
        assignment.employeeId,
        assignment.templateCode,
        assignment.kind,
        assignment.status,
        assignment.assignedAt,
      )

      // last_insert_rowid() は直後の 1 文でしか使えない（タスク INSERT で上書きされる）。
      // assignment は autoincrement なので MAX(id) はバッチ内で安定して参照できる。
      const taskStmts = assignment.tasks.map((task) =>
        this.c.env.DB.prepare(
          `INSERT INTO onboarding_tasks (assignment_id, template_task_code, title, sort_order, status, completed_at)
           VALUES ((SELECT MAX(id) FROM onboarding_assignments), ?1, ?2, ?3, ?4, ?5)`,
        ).bind(
          task.templateTaskCode,
          task.title,
          task.order,
          task.status,
          task.completedAt,
        ),
      )

      const results = await this.c.env.DB.batch([assignmentStmt, ...taskStmts])

      const assignmentRow = results[0]?.results?.at(0) as
        | { id: number }
        | undefined

      if (assignmentRow === undefined) {
        return new Error("failed to insert onboarding assignment")
      }

      const result = await this.findById(assignmentRow.id)

      if (result === null) {
        return new Error("failed to create onboarding assignment")
      }

      return result
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert onboarding assignment")
    }
  }

  async findById(assignmentId: number): Promise<OnboardingAssignment | null | Error> {
    try {
      const assignmentRows = await this.c.var.database
        .select()
        .from(onboardingAssignments)
        .where(eq(onboardingAssignments.id, assignmentId))
        .limit(1)

      const assignmentRow = assignmentRows.at(0)

      if (assignmentRow === undefined) {
        return null
      }

      const taskRows = await this.c.var.database
        .select()
        .from(onboardingTasks)
        .where(eq(onboardingTasks.assignmentId, assignmentId))
        .orderBy(asc(onboardingTasks.sortOrder))

      const tasks = taskRows.map((row) => OnboardingTask.fromRow(row))

      return OnboardingAssignment.fromRow(assignmentRow, tasks)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load onboarding assignment")
    }
  }

  async findByTaskId(taskId: number): Promise<OnboardingAssignment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select({ assignmentId: onboardingTasks.assignmentId })
        .from(onboardingTasks)
        .where(eq(onboardingTasks.id, taskId))
        .limit(1)

      const row = rows.at(0)

      if (row === undefined) {
        return null
      }

      return this.findById(row.assignmentId)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load onboarding assignment")
    }
  }

  async findByEmployeeId(employeeId: number): Promise<ReadonlyArray<OnboardingAssignment> | Error> {
    try {
      const assignmentRows = await this.c.var.database
        .select()
        .from(onboardingAssignments)
        .where(eq(onboardingAssignments.employeeId, employeeId))

      const assignmentIds = assignmentRows.map((row) => row.id)

      if (assignmentIds.length === 0) {
        return []
      }

      const taskRows = await this.c.var.database
        .select()
        .from(onboardingTasks)
        .where(inArray(onboardingTasks.assignmentId, assignmentIds))
        .orderBy(asc(onboardingTasks.sortOrder))

      const tasksByAssignmentId = new Map<number, Array<OnboardingTask>>()

      for (const row of taskRows) {
        const tasks = tasksByAssignmentId.get(row.assignmentId)
        if (tasks !== undefined) {
          tasks.push(OnboardingTask.fromRow(row))
        } else {
          tasksByAssignmentId.set(row.assignmentId, [OnboardingTask.fromRow(row)])
        }
      }

      return assignmentRows.map((assignmentRow) => {
        const tasks = tasksByAssignmentId.get(assignmentRow.id) ?? []
        return OnboardingAssignment.fromRow(assignmentRow, tasks)
      })
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load onboarding assignments")
    }
  }

  async update(assignment: OnboardingAssignment): Promise<OnboardingAssignment | Error> {
    try {
      if (assignment.id === null) {
        return new Error("cannot update unsaved onboarding assignment")
      }

      const assignmentStmt = this.c.var.database
        .update(onboardingAssignments)
        .set({ status: assignment.status, assignedAt: assignment.assignedAt })
        .where(eq(onboardingAssignments.id, assignment.id))

      const taskStmts = assignment.tasks
        .filter((task) => task.id !== null)
        .map((task) =>
          this.c.var.database
            .update(onboardingTasks)
            .set({ status: task.status, completedAt: task.completedAt })
            .where(eq(onboardingTasks.id, task.id as number)),
        )

      await this.c.var.database.batch([assignmentStmt, ...taskStmts])

      const result = await this.findById(assignment.id)

      if (result === null) {
        return new Error("failed to update onboarding assignment")
      }

      return result
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update onboarding assignment")
    }
  }

  // 割り当てとその配下タスクを削除する。
  async delete(assignmentId: number): Promise<null | Error> {
    try {
      await this.c.var.database.batch([
        this.c.var.database
          .delete(onboardingTasks)
          .where(eq(onboardingTasks.assignmentId, assignmentId)),
        this.c.var.database
          .delete(onboardingAssignments)
          .where(eq(onboardingAssignments.id, assignmentId)),
      ])

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete onboarding assignment")
    }
  }
}
