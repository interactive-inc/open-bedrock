import { CreateAnnouncement } from "@/contexts/announcement/application/create-announcement"
import { factory } from "@/contexts/company/interface/utils/factory"
import { announcements } from "@/contexts/announcement/infrastructure/schema/announcement"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppAnnouncement, zAppAnnouncementList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/**
 * GET /announcements — 社内アナウンス一覧。
 * 既定は published のみ。管理者は status クエリで draft / archived も閲覧できる。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const canManage = session.hasPermission("announcement:manage")

  const statusQuery = c.req.query("status") ?? null

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

  const conditions: Array<SQL> = []

  // 管理者以外は published 固定。管理者は status 指定があればそれで絞る。
  if (canManage === false) {
    conditions.push(eq(announcements.status, "published"))
  } else if (statusQuery !== null) {
    conditions.push(eq(announcements.status, statusQuery))
  }

  const where = conditions.length === 0 ? undefined : and(...conditions)

  const [rows, totalRows] = await Promise.all([
    c.var.database
      .select()
      .from(announcements)
      .where(where)
      .orderBy(desc(announcements.id))
      .limit(limit)
      .offset(offset),
    c.var.database.select({ total: count() }).from(announcements).where(where),
  ])

  const responseBody = zAppAnnouncementList.parse({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      published_on: row.publishedOn,
      author_employee_id: row.authorEmployeeId,
      created_at: row.createdAt,
    })),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /announcements — 社内アナウンスを draft で新規作成（announcement:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      title: z.string().min(1).max(500),
      body_md: z.string().min(1).max(50_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateAnnouncement(c).run({
      session: session,
      title: json.title,
      bodyMd: json.body_md,
      authorEmployeeId: session.employeeId,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppAnnouncement.parse({
      id: created.id,
      title: created.title,
      body_md: created.bodyMd,
      status: created.status,
      published_on: created.publishedOn,
      author_employee_id: created.authorEmployeeId,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
