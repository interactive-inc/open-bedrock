import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
import { zAppOnboardingAssignmentList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company-compatibility/interface/utils/to-bounded-int"
import { validateCodeParam } from "@/contexts/company-compatibility/interface/utils/validate-code-param"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company-compatibility/infrastructure/schema/employee"
import {
  onboardingAssignments,
  onboardingTasks,
  onboardingTemplates,
} from "@/contexts/onboarding/infrastructure/schema/onboarding"
import { asc, count, eq, inArray } from "drizzle-orm"

// @authorization permission - 権限キーで判定する
/** GET /onboarding-assignments/employees/:employee_code — 指定社員の手続き一覧（特権ロールのみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("onboarding:view:all") === false) {
    throw new ForbiddenError()
  }

  const code = validateCodeParam(c.req.param("employee_code"), "employee")

  const employeeRows = await c.var.database
    .select()
    .from(employees)
    .where(eq(employees.code, code))
    .limit(1)

  const employee = employeeRows.at(0)

  if (employee === undefined) {
    throw new NotFoundError("employee not found")
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const assignmentRows = await c.var.database
    .select({ assignment: onboardingAssignments, templateName: onboardingTemplates.name })
    .from(onboardingAssignments)
    .leftJoin(onboardingTemplates, eq(onboardingTemplates.code, onboardingAssignments.templateCode))
    .where(eq(onboardingAssignments.employeeId, employee.id))
    .orderBy(asc(onboardingAssignments.id))
    .limit(limit)
    .offset(offset)

  const assignmentIds = assignmentRows.map((row) => row.assignment.id)

  // タスクは LIMIT 後に返す割り当て分だけ取得する（ページ外の割り当てのタスクを読まない）。
  const taskRows =
    assignmentIds.length === 0
      ? []
      : await c.var.database
          .select({ task: onboardingTasks })
          .from(onboardingTasks)
          .where(inArray(onboardingTasks.assignmentId, assignmentIds))

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(onboardingAssignments)
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

  const responseBody = zAppOnboardingAssignmentList.parse({
    data: body,
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
