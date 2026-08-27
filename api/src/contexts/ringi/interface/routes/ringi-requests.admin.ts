import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { alias } from "drizzle-orm/sqlite-core"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { ringiRequests } from "@/contexts/ringi/infrastructure/schema/ringi"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
import { zAppRingiAdminList } from "@/lib/app-schemas"
import { ringiStatusSchema } from "@/lib/schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { z } from "zod"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { loadCurrentEmployeeDepartmentNames } from "@/api/http/utils/current-employee-departments"
import { InternalError } from "@/lib/http/errors"

/** 並び順ホワイトリスト。未知の値は created_at desc にフォールバックする。 */
const SORT_OPTIONS = {
  created_at_desc: desc(ringiRequests.createdAt),
  created_at_asc: asc(ringiRequests.createdAt),
  amount_desc: desc(ringiRequests.amount),
  amount_asc: asc(ringiRequests.amount),
} as const

type SortKey = keyof typeof SORT_OPTIONS

const approvers = alias(employees, "approvers")

// @authorization permission - 権限キーで判定する
/**
 * GET /ringi-requests/admin — 全社の稟議を横断で閲覧する管理画面用の一覧。
 * ringi:read:all を持つロール(admin / auditor / executive)のみ許可。
 * フィルタ: status / applicant_id。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: ringiStatusSchema.optional(),
      applicant_id: zEmployeeId.optional(),
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

    if (session.hasPermission("ringi:read:all") === false) {
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
      conditions.push(eq(ringiRequests.status, query.status))
    }

    if (query.applicant_id !== undefined) {
      conditions.push(eq(ringiRequests.applicantId, query.applicant_id))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const sortQuery = query.sort ?? ""

    const sortKey: SortKey = Object.hasOwn(SORT_OPTIONS, sortQuery)
      ? (sortQuery as SortKey)
      : "created_at_desc"

    const rows = await c.var.database
      .select({
        id: ringiRequests.id,
        applicantId: ringiRequests.applicantId,
        applicantName: employees.officialName,
        approverId: ringiRequests.approverId,
        approverName: approvers.officialName,
        title: ringiRequests.title,
        amount: ringiRequests.amount,
        status: ringiRequests.status,
        decidedAt: ringiRequests.decidedAt,
        createdAt: ringiRequests.createdAt,
      })
      .from(ringiRequests)
      .leftJoin(employees, eq(employees.id, ringiRequests.applicantId))
      .leftJoin(approvers, eq(approvers.id, ringiRequests.approverId))
      .where(where)
      .orderBy(SORT_OPTIONS[sortKey])
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(ringiRequests)
      .where(where)

    const currentDepartments = await loadCurrentEmployeeDepartmentNames(
      c,
      rows.map((row) => row.applicantId),
    )
    if (currentDepartments instanceof Error) {
      throw new InternalError("failed to load current departments")
    }

    const responseBody = zAppRingiAdminList.parse({
      data: rows.map((row) => ({
        id: row.id,
        applicant_id: row.applicantId,
        applicant_name: row.applicantName ?? "",
        applicant_dept_name: currentDepartments.get(row.applicantId) ?? null,
        approver_id: row.approverId,
        approver_name: row.approverName ?? "",
        title: row.title,
        amount: row.amount,
        status: row.status,
        decided_at: row.decidedAt,
        created_at: row.createdAt,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
