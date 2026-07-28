import { listDepartmentEmployeeIds } from "@/interface/utils/list-department-employee-ids"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { applications, applicationTemplates, employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, count, eq, inArray } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/interface/lib/errors"
import { zAppApplicationAdminList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { z } from "zod"

/**
 * GET /applications — 本人の申請一覧（ステータスで絞り込み可）。
 * scope=department&department_code= で部署メンバー全員分を一覧する(対応 permission 必須)。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      scope: z.enum(["department"]).optional(),
      department_code: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const query = c.req.valid("query")

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const conditions: Array<SQL> = []

    if (query.scope === "department") {
      const departmentCode = query.department_code ?? null

      if (departmentCode === null) {
        throw new UnprocessableEntityError("department_code is required for scope=department")
      }

      const departmentEmployeeIds = await listDepartmentEmployeeIds({ c, departmentCode })

      if (departmentEmployeeIds instanceof Error) {
        throw new InternalError("failed to resolve department employees")
      }

      // 部署スコープは、全社閲覧権限があるか、自分がその部署に所属し部署閲覧権限を持つ場合だけ許可する。
      const isMember = departmentEmployeeIds.includes(session.employeeId)

      const allowed =
        session.hasPermission("application:read:all") ||
        (session.hasPermission("application:read:department") && isMember)

      if (allowed === false) {
        throw new ForbiddenError()
      }

      if (departmentEmployeeIds.length === 0) {
        const emptyBody = zAppApplicationAdminList.parse({ data: [], total: 0 })

        return c.json(emptyBody, 200)
      }

      conditions.push(inArray(applications.applicantId, departmentEmployeeIds))
    } else {
      conditions.push(eq(applications.applicantId, session.employeeId))
    }

    if (query.status !== undefined) {
      conditions.push(eq(applications.status, query.status))
    }

    const rows = await c.var.database
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        applicantName: employees.name,
        applicantDeptName: employees.deptName,
        status: applications.status,
        currentStep: applications.currentStep,
        createdAt: applications.createdAt,
        templateCode: applicationTemplates.code,
        templateName: applicationTemplates.name,
        templateCategory: applicationTemplates.category,
      })
      .from(applications)
      .leftJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
      .leftJoin(employees, eq(employees.id, applications.applicantId))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(applications)
      .where(and(...conditions))

    const responseBody = zAppApplicationAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        template_code: row.templateCode ?? "",
        template_name: row.templateName ?? "",
        template_category: row.templateCategory ?? "",
        applicant_id: row.applicantId,
        applicant_name: row.applicantName ?? "",
        applicant_dept_name: row.applicantDeptName,
        current_step: row.currentStep,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
