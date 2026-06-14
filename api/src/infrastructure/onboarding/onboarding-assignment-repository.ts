import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment.entity"
import { OnboardingTask } from "@/domain/onboarding/onboarding-task.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { onboardingAssignments, onboardingTasks } from "@/schema"
import { and, asc, count, eq, inArray, ne } from "drizzle-orm"

export class OnboardingAssignmentRepository {
  constructor(private readonly c: Context) {}

  async create(assignment: OnboardingAssignment): Promise<OnboardingAssignment | Error> {
    try {
      // assignment の id は AUTOINCREMENT のため先に INSERT して採番し、
      // 続けて tasks を batch INSERT する。tasks の batch は D1 内部で
      // トランザクション化されるため個別タスク間はアトミック。
      const assignmentRows = await this.c.var.database
        .insert(onboardingAssignments)
        .values({
          employeeId: assignment.employeeId,
          templateCode: assignment.templateCode,
          kind: assignment.kind,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
        })
        .returning()

      const assignmentRow = assignmentRows.at(0)

      if (assignmentRow === undefined) {
        return new Error("failed to insert onboarding assignment")
      }

      if (assignment.tasks.length > 0) {
        const taskStmts = assignment.tasks.map((task) =>
          this.c.var.database.insert(onboardingTasks).values({
            assignmentId: assignmentRow.id,
            templateTaskCode: task.templateTaskCode,
            title: task.title,
            sortOrder: task.order,
            status: task.status,
            completedAt: task.completedAt,
          }),
        )

        try {
          await this.c.var.database.batch(
            taskStmts as [(typeof taskStmts)[number], ...(typeof taskStmts)[number][]],
          )
        } catch (err) {
          // 補償削除: tasks INSERT 失敗時に assignment を削除
          await this.c.var.database
            .delete(onboardingAssignments)
            .where(eq(onboardingAssignments.id, assignmentRow.id))
          return err instanceof Error ? err : new Error("failed to create tasks")
        }
      }

      const result = await this.findById(assignmentRow.id)

      if (result === null) {
        return new Error("failed to create onboarding assignment")
      }

      return result
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("onboarding assignment already exists", {
          cause: error,
        })
      }
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

      const taskStmts = assignment.tasks.flatMap((task) => {
        if (task.id === null) {
          return []
        }

        const taskId = task.id

        return [
          this.c.var.database
            .update(onboardingTasks)
            .set({ status: task.status, completedAt: task.completedAt })
            .where(eq(onboardingTasks.id, taskId)),
        ]
      })

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

  // employee_id と templateCode の組み合わせで completed 以外の割り当てを探す。
  async findActiveByEmployeeAndTemplate(
    employeeId: number,
    templateCode: string,
  ): Promise<OnboardingAssignment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(onboardingAssignments)
        .where(
          and(
            eq(onboardingAssignments.employeeId, employeeId),
            eq(onboardingAssignments.templateCode, templateCode),
            ne(onboardingAssignments.status, "completed"),
          ),
        )
        .limit(1)

      const row = rows.at(0)

      if (row === undefined) {
        return null
      }

      return this.findById(row.id)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to check existing assignment")
    }
  }

  // 指定テンプレートコードに紐づく in_progress 状態の割り当て数を返す。
  async countActiveByTemplateCode(templateCode: string): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ value: count() })
        .from(onboardingAssignments)
        .where(
          and(
            eq(onboardingAssignments.templateCode, templateCode),
            eq(onboardingAssignments.status, "in_progress"),
          ),
        )

      return rows.at(0)?.value ?? 0
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error("failed to count active onboarding assignments")
    }
  }

  // 割り当てとその配下タスクを削除する。status が completed のときは削除せず null を返す。
  // assignment を先に DELETE し、ガード文で 0 行なら後続の tasks DELETE を abort する。
  async delete(assignmentId: number): Promise<true | null | Error> {
    try {
      const db = this.c.env.DB
      await db.batch([
        db
          .prepare("DELETE FROM onboarding_assignments WHERE id = ?1 AND status != 'completed'")
          .bind(assignmentId),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare("DELETE FROM onboarding_tasks WHERE assignment_id = ?1").bind(assignmentId),
      ])

      return true
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to delete onboarding assignment")
    }
  }
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

// ガード文（abortWhenPreviousStatementChangedNoRows）の json_extract('', '$') による
// 意図的な abort かを判定する。これ以外の batch 失敗は本物の DB エラーとして伝播させる。
function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
