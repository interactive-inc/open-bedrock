import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppRingiInboxList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { ringiRequests } from "@/contexts/ringi/infrastructure/schema/ringi"
import { and, count, desc, eq } from "drizzle-orm"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"

// @authorization owner - 本人のリソースに限定する
/** GET /ringi-requests/inbox — 自分が承認者の承認待ち稟議一覧（指名された承認者本人のみ見える） */
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

  const conditions = [
    eq(ringiRequests.approverId, session.employeeId),
    eq(ringiRequests.status, "pending"),
  ]

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select({ ringi: ringiRequests, applicantName: employees.name })
      .from(ringiRequests)
      .leftJoin(employees, eq(employees.id, ringiRequests.applicantId))
      .where(and(...conditions))
      .orderBy(desc(ringiRequests.id))
      .limit(limit)
      .offset(offset),
    c.var.database
      .select({ total: count() })
      .from(ringiRequests)
      .where(and(...conditions)),
  ])

  const responseBody = zAppRingiInboxList.parse({
    data: rows.map((row) => ({
      id: row.ringi.id,
      applicant_id: row.ringi.applicantId,
      applicant_name: row.applicantName ?? "",
      title: row.ringi.title,
      amount: row.ringi.amount,
      reason: row.ringi.reason,
      status: row.ringi.status,
      created_at: row.ringi.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})
