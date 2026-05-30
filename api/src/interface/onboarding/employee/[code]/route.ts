import { canViewEmployeeOnboarding } from "@/domain/onboarding/can-view-employee-onboarding"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, onboardingAssignments, onboardingTasks, onboardingTemplates } from "@/schema"
import { eq } from "drizzle-orm"

// GET /onboarding/employee/:code — 指定社員の手続き一覧（特権ロールのみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canViewEmployeeOnboarding({ viewerRole: session.role }) === false) {
    throw new ForbiddenError()
  }

  const code = c.req.param("code") ?? ""

  const employeeRows = await c.var.database
    .select()
    .from(employees)
    .where(eq(employees.code, code))
    .limit(1)

  const employee = employeeRows.at(0)

  if (employee === undefined) {
    throw new NotFoundError("employee not found")
  }

  const assignmentRows = await c.var.database
    .select({ assignment: onboardingAssignments, templateName: onboardingTemplates.name })
    .from(onboardingAssignments)
    .leftJoin(onboardingTemplates, eq(onboardingTemplates.code, onboardingAssignments.templateCode))
    .where(eq(onboardingAssignments.employeeId, employee.id))

  const taskRows = await c.var.database
    .select({ task: onboardingTasks })
    .from(onboardingTasks)
    .innerJoin(onboardingAssignments, eq(onboardingAssignments.id, onboardingTasks.assignmentId))
    .where(eq(onboardingAssignments.employeeId, employee.id))

  const body = assignmentRows.map((row) => ({
    id: row.assignment.id,
    employee_code: employee.code,
    employee_name: employee.name,
    template_code: row.assignment.templateCode,
    template_name: row.templateName ?? "",
    kind: row.assignment.kind,
    status: row.assignment.status,
    assigned_at: row.assignment.assignedAt,
    tasks: taskRows
      .filter((taskRow) => taskRow.task.assignmentId === row.assignment.id)
      .map((taskRow) => ({
        id: taskRow.task.id,
        template_task_code: taskRow.task.templateTaskCode,
        title: taskRow.task.title,
        order: taskRow.task.sortOrder,
        status: taskRow.task.status,
        completed_at: taskRow.task.completedAt,
      })),
  }))

  return c.json(body, 200)
})
