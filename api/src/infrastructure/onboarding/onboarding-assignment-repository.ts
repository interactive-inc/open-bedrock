import { OnboardingAssignment } from "@/domain/onboarding/onboarding-assignment"
import { OnboardingTask } from "@/domain/onboarding/onboarding-task"
import type { Context } from "@/env"
import { onboardingAssignments, onboardingTasks } from "@/schema"
import { asc, eq } from "drizzle-orm"

export class OnboardingAssignmentRepository {
  constructor(private readonly c: Context) {}

  async create(assignment: OnboardingAssignment): Promise<OnboardingAssignment | Error> {
    try {
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

      for (const task of assignment.tasks) {
        await this.c.var.database.insert(onboardingTasks).values({
          assignmentId: assignmentRow.id,
          templateTaskCode: task.templateTaskCode,
          title: task.title,
          sortOrder: task.order,
          status: task.status,
          completedAt: task.completedAt,
        })
      }

      return this.findById(assignmentRow.id)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to insert onboarding assignment")
    }
  }

  async findById(assignmentId: number): Promise<OnboardingAssignment | Error> {
    try {
      const assignmentRows = await this.c.var.database
        .select()
        .from(onboardingAssignments)
        .where(eq(onboardingAssignments.id, assignmentId))
        .limit(1)

      const assignmentRow = assignmentRows.at(0)

      if (assignmentRow === undefined) {
        return new Error("failed to load onboarding assignment")
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

      const assignments: Array<OnboardingAssignment> = []

      for (const assignmentRow of assignmentRows) {
        const taskRows = await this.c.var.database
          .select()
          .from(onboardingTasks)
          .where(eq(onboardingTasks.assignmentId, assignmentRow.id))
          .orderBy(asc(onboardingTasks.sortOrder))

        const tasks = taskRows.map((row) => OnboardingTask.fromRow(row))

        assignments.push(OnboardingAssignment.fromRow(assignmentRow, tasks))
      }

      return assignments
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load onboarding assignments")
    }
  }

  async update(assignment: OnboardingAssignment): Promise<OnboardingAssignment | Error> {
    try {
      if (assignment.id === null) {
        return new Error("cannot update unsaved onboarding assignment")
      }

      await this.c.var.database
        .update(onboardingAssignments)
        .set({ status: assignment.status })
        .where(eq(onboardingAssignments.id, assignment.id))

      for (const task of assignment.tasks) {
        if (task.id === null) {
          continue
        }

        await this.c.var.database
          .update(onboardingTasks)
          .set({ status: task.status, completedAt: task.completedAt })
          .where(eq(onboardingTasks.id, task.id))
      }

      return this.findById(assignment.id)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update onboarding assignment")
    }
  }
}
