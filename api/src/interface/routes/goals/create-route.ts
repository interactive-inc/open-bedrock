import { CreateGoal } from "@/application/goal/create-goal"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGoal } from "@/lib/app-schemas"
import { canWriteDepartmentGoal } from "@/lib/goal/can-write-department-goal"
import { resolveEmployeeDepartmentCode } from "@/lib/org/resolve-employee-department-code"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

/**
 * POST /goals — 目標を新規作成する。
 * owner_type 省略時は individual(本人の個人目標)。company は review:administer 保持者、
 * department は対象部門のマネージャー(goal:evaluate:reports)か review:administer のみ作成できる。
 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      period: z.string().min(1).max(100),
      title: z.string().min(1).max(500),
      weight: z.number().int().min(1).max(100).default(10),
      kpi: z.string().max(3_000).optional(),
      owner_type: z.enum(["individual", "department", "company"]).default("individual"),
      parent_goal_id: z.number().int().positive().nullable().optional(),
      department_code: z.string().min(1).max(100).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    if (json.owner_type === "company") {
      if (session.hasPermission("review:administer") === false) {
        throw new ForbiddenError()
      }
    }

    if (json.owner_type === "department") {
      const departmentCode = json.department_code ?? null

      if (departmentCode === null) {
        throw new ForbiddenError()
      }

      const viewerDepartmentCode = await resolveEmployeeDepartmentCode({
        c,
        employeeId: session.employeeId,
      })

      if (viewerDepartmentCode instanceof Error) {
        throw new InternalError("failed to resolve viewer department")
      }

      const canWrite = canWriteDepartmentGoal({
        session,
        departmentCode,
        viewerDepartmentCode,
      })

      if (canWrite === false) {
        throw new ForbiddenError()
      }
    }

    const goal = await new CreateGoal(c).run({
      employeeId: session.employeeId,
      period: json.period,
      title: json.title,
      kpi: json.kpi ?? null,
      weight: json.weight,
      ownerType: json.owner_type,
      parentGoalId: json.parent_goal_id ?? null,
      departmentCode: json.owner_type === "department" ? (json.department_code ?? null) : null,
    })

    if (goal instanceof ApplicationError) {
      throw toHttpException(goal)
    }

    const responseBody = zAppGoal.parse({
      id: goal.id,
      employee_id: goal.employeeId,
      period: goal.period,
      title: goal.title,
      kpi: goal.kpi,
      weight: goal.weight,
      status: goal.status,
      owner_type: goal.ownerType,
      parent_goal_id: goal.parentGoalId,
      department_code: goal.departmentCode,
    })

    return c.json(responseBody, 201)
  },
)
