import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { applications, applicationTemplates, employees } from "@/schema"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { asc, count, desc, eq } from "drizzle-orm"

/** 並び順クエリのホワイトリスト。未知の値は created_at desc にフォールバックする。 */
const SORT_OPTIONS = {
  created_at_desc: desc(applications.createdAt),
  created_at_asc: asc(applications.createdAt),
} as const

type SortKey = keyof typeof SORT_OPTIONS
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplicationInboxList } from "@/lib/app-schemas"
import { InternalError } from "@/interface/lib/errors"
import { resolveApplicationInboxCondition } from "@/lib/application/resolve-application-inbox-condition"

/**
 * GET /applications/inbox — 承認待ちの申請一覧。
 * 旧テンプレートは application:approve、approverRoles、組織スコープをすべて満たす場合だけ返す。
 * 設定済みワークフローは固定された案件候補者またはその有効な代理人だけを返す。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
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

  const now = c.env.NOW ?? new Date().toISOString()
  const pendingWithRole = await resolveApplicationInboxCondition({ c, session, now })
  if (pendingWithRole instanceof Error) {
    throw new InternalError("failed to resolve application inbox scope")
  }

  const sortQuery = c.req.query("sort") ?? ""

  const sortKey: SortKey = sortQuery in SORT_OPTIONS ? (sortQuery as SortKey) : "created_at_desc"

  // 一覧では payload（大きい JSON 文字列）を返さないため、必要な列だけを取得する。
  const rows = await c.var.database
    .select({
      id: applications.id,
      currentStep: applications.currentStep,
      status: applications.status,
      createdAt: applications.createdAt,
      templateName: applicationTemplates.name,
      applicantName: employees.name,
    })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .leftJoin(employees, eq(employees.id, applications.applicantId))
    .where(pendingWithRole)
    .orderBy(SORT_OPTIONS[sortKey])
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .where(pendingWithRole)

  const responseBody = zAppApplicationInboxList.parse({
    data: rows.map((row) => ({
      id: row.id,
      template_name: row.templateName ?? "",
      applicant_name: row.applicantName ?? "",
      current_step: row.currentStep,
      status: row.status,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
