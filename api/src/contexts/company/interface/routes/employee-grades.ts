import { CreateEmployeeGrade } from "@/contexts/company/application/grade/create-employee-grade"
import { canReadGradeOf } from "@/contexts/company/interface/http/employee-grades/can-read-grade-of"
import { resolveEmployeeRelation } from "@/contexts/company/infrastructure/organization/resolve-employee-relation.repository"
import { resolveTargetEmployeeId } from "@/contexts/company/interface/utils/resolve-target-employee-id"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppEmployeeGrade, zAppEmployeeGradeList } from "@/lib/app-schemas"
import { EmployeeGradeRepository } from "@/contexts/company/infrastructure/grade/employee-grade.repository"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /employee-grades?employee_id= — 従業員の等級割当履歴（self / grade:read:all / 配下かつ grade:read:reports） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const targetEmployeeId = await resolveTargetEmployeeId({
    c,
    employeeIdParam: c.req.query("employee_id"),
    employeeCodeParam: c.req.query("employee_code"),
    sessionEmployeeId: session.employeeId,
  })

  if (targetEmployeeId instanceof Error) {
    throw new InternalError("failed to resolve target employee")
  }

  if (targetEmployeeId === null) {
    throw new NotFoundError("employee not found")
  }

  const isViewingOthers = targetEmployeeId !== session.employeeId

  if (isViewingOthers) {
    const relation = await resolveEmployeeRelation({
      c,
      viewerEmployeeId: session.employeeId,
      targetEmployeeId,
    })

    if (relation instanceof Error) {
      throw new InternalError("failed to resolve employee relation")
    }

    if (canReadGradeOf(session, relation) === false) {
      throw new ForbiddenError()
    }
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

  const repository = new EmployeeGradeRepository(c)

  const assignments = await repository.findByEmployeeId({
    employeeId: targetEmployeeId,
    limit,
    offset,
  })

  if (assignments instanceof Error) {
    throw new InternalError("failed to load employee grades")
  }

  const total = await repository.countByEmployeeId(targetEmployeeId)

  if (total instanceof Error) {
    throw new InternalError("failed to count employee grades")
  }

  const responseBody = zAppEmployeeGradeList.parse({
    data: assignments.map((assignment) => ({
      id: assignment.id,
      employee_id: assignment.employeeId,
      grade_id: assignment.gradeId,
      effective_date: assignment.effectiveDate,
      reason: assignment.reason,
      created_at: assignment.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /employee-grades — 等級の割当を記録（grade:manage） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_id: z.number().int().positive(),
      grade_id: z.number().int().positive(),
      effective_date: isoDate,
      reason: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const assignment = await new CreateEmployeeGrade(c).run({
      session,
      employeeId: json.employee_id,
      gradeId: json.grade_id,
      effectiveDate: json.effective_date,
      reason: json.reason ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (assignment instanceof ApplicationError) {
      throw toHttpException(assignment)
    }

    const responseBody = zAppEmployeeGrade.parse({
      id: assignment.id,
      employee_id: assignment.employeeId,
      grade_id: assignment.gradeId,
      effective_date: assignment.effectiveDate,
      reason: assignment.reason,
      created_at: assignment.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
