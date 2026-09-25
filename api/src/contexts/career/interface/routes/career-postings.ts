import { CareerOrganizationUnitAdapter } from "@/contexts/career/infrastructure/adapters/career-organization-unit.adapter"
import { CareerPostingRepository } from "@/contexts/career/infrastructure/repositories/career-posting.repository"
import { CreateCareerPosting } from "@/contexts/career/application/create-career-posting"
import { CareerPosting } from "@/contexts/career/domain/entities/career-posting.entity"
import {
  toCareerPostingResponse,
  toCareerPostingResponses,
} from "@/contexts/career/interface/http/career-posting-response"
import { zOrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppCareerPostingList } from "@/contexts/career/interface/http/response-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { careerPostings } from "@/contexts/career/infrastructure/schema/career"
import { zValidator } from "@hono/zod-validator"
import { count, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /career-postings — 公開中の公募一覧 */
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

  const rows = await c.var.database
    .select()
    .from(careerPostings)
    .where(eq(careerPostings.status, "open"))
    // 移行前の公募は作成日時が同じなので、旧来の整数の主キーの順で並べる。
    .orderBy(
      desc(careerPostings.createdAt),
      desc(sql`CAST(${careerPostings.legacyId} AS INTEGER)`),
      desc(careerPostings.id),
    )
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(careerPostings)
    .where(eq(careerPostings.status, "open"))

  const responseBody = zAppCareerPostingList.parse({
    data: await toCareerPostingResponses(
      c,
      rows.map((row) => CareerPosting.fromRow(row)),
    ),
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /career-postings — 公募を新規作成（管理ロールのみ） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.strictObject({
      title: z.string().min(1).max(500),
      organization_unit_id: zOrganizationUnitId.nullable().optional(),
      required_skills: z.string().max(3_000).nullable().optional(),
      status: z.enum(["open", "closed"]).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new CreateCareerPosting({
      postingRepository: new CareerPostingRepository(c),
      organizationUnits: new CareerOrganizationUnitAdapter(c),
    }).run({
      session: session,
      title: body.title,
      organizationUnitId: body.organization_unit_id ?? null,
      requiredSkills: body.required_skills ?? null,
      status: body.status ?? "open",
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = await toCareerPostingResponse(c, created)

    return c.json(responseBody, 201)
  },
)
