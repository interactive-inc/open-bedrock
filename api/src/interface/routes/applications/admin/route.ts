import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { applications, applicationTemplates, employees } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplicationAdminList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { z } from "zod"
import { loadCurrentEmployeeDepartmentNames } from "@/lib/org/current-employee-departments"
import { InternalError } from "@/interface/lib/errors"

/** 並び順のホワイトリスト。未知の値は created_at desc にフォールバックする。 */
const SORT_OPTIONS = {
  created_at_desc: desc(applications.createdAt),
  created_at_asc: asc(applications.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS

/**
 * GET /applications/admin — 全社の申請を横断で閲覧する管理画面用の一覧。
 * application:read:all を持つロール(hr / admin)のみ許可。申請本文(payload)は返さない。
 * フィルタ: status / applicant_id / template_id / created_at 範囲(from / to)。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      applicant_id: z.string().optional(),
      template_code: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("application:read:all") === false) {
      throw new ForbiddenError()
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

    if (query.status !== undefined) {
      conditions.push(eq(applications.status, query.status))
    }

    // 数値でない applicant_id は 400 相当ではなくサイレントに無視する(未指定と同じ扱い)。
    // 一覧ページのフィルタ UI が空文字を送りうるため。
    if (query.applicant_id !== undefined && query.applicant_id !== "") {
      const applicantId = Number(query.applicant_id)

      if (Number.isInteger(applicantId)) {
        conditions.push(eq(applications.applicantId, applicantId))
      }
    }

    if (query.template_code !== undefined && query.template_code !== "") {
      conditions.push(eq(applicationTemplates.code, query.template_code))
    }

    if (query.from !== undefined && query.from !== "") {
      conditions.push(gte(applications.createdAt, query.from))
    }

    if (query.to !== undefined && query.to !== "") {
      conditions.push(lte(applications.createdAt, query.to))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "created_at_desc"

    const rows = await c.var.database
      .select({
        id: applications.id,
        templateCode: applicationTemplates.code,
        templateName: applicationTemplates.name,
        templateCategory: applicationTemplates.category,
        applicantId: applications.applicantId,
        applicantName: employees.name,
        applicantDeptName: employees.deptName,
        currentStep: applications.currentStep,
        status: applications.status,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
      .leftJoin(employees, eq(employees.id, applications.applicantId))
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(applications)
      .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
      .where(where)

    const currentDepartments = await loadCurrentEmployeeDepartmentNames(
      c,
      rows.map((row) => row.applicantId),
    )
    if (currentDepartments instanceof Error) {
      throw new InternalError("failed to load current departments")
    }

    const responseBody = zAppApplicationAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        template_code: row.templateCode ?? "",
        template_name: row.templateName ?? "",
        template_category: row.templateCategory ?? "",
        applicant_id: row.applicantId,
        applicant_name: row.applicantName ?? "",
        applicant_dept_name:
          currentDepartments.source === "lifecycle"
            ? (currentDepartments.names.get(row.applicantId) ?? null)
            : row.applicantDeptName,
        current_step: row.currentStep,
        status: row.status,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
