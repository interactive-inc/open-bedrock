import { canDecideApplication } from "@/domain/application/can-decide-application"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { applications, applicationTemplates, employees } from "@/schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { and, count, eq, like, or } from "drizzle-orm"
import { UnauthorizedError } from "@/interface/lib/errors"

// GET /applications/inbox — 承認待ちの申請一覧。
// テンプレートの approverRoles に自分のロールが含まれるか、approverRoles が空で
// canDecideApplication を満たす場合に表示する。DecideApplication の権限判定と対称にする。
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

  // approverRoles は JSON 配列文字列（例: '["manager","admin"]'）。
  // viewer のロールがリストに含まれるテンプレートの申請だけを返す。
  // approverRoles が空（"[]"）の場合は canDecideApplication で許可されたロールだけ。
  // DecideApplication の approverRoles チェックと同じ二分岐に合わせる。
  const rolePattern = `%"${session.role}"%`

  const isPrivileged = canDecideApplication(session.role)

  const pendingWithRole = and(
    eq(applications.status, "pending"),
    or(
      isPrivileged ? eq(applicationTemplates.approverRoles, "[]") : undefined,
      like(applicationTemplates.approverRoles, rolePattern),
    ),
  )

  const rows = await c.var.database
    .select({
      application: applications,
      templateName: applicationTemplates.name,
      applicantName: employees.name,
    })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .leftJoin(employees, eq(employees.id, applications.applicantId))
    .where(pendingWithRole)
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(applications)
    .innerJoin(applicationTemplates, eq(applicationTemplates.id, applications.templateId))
    .where(pendingWithRole)

  const responseBody = rows.map((row) => ({
    id: row.application.id,
    template_name: row.templateName ?? "",
    applicant_name: row.applicantName ?? "",
    current_step: row.application.currentStep,
    status: row.application.status,
    created_at: row.application.createdAt,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
