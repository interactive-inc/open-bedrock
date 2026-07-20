import { RegisterRegulation } from "@/application/regulation/register-regulation"
import { factory } from "@/lib/factory"
import { regulations, regulationVersions } from "@/schema"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppRegulation, zAppRegulationList } from "@/lib/app-schemas"
import { codeSchema } from "@/lib/schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import { and, asc, count, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** GET /regulations — 規程集一覧（全認証者）。各規程の最新版のメタも返す。 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["active", "archived"]).optional(),
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

    if (query.status !== undefined) {
      conditions.push(eq(regulations.status, query.status))
    }

    const where = conditions.length === 0 ? undefined : and(...conditions)

    const [rows, totalRows] = await Promise.all([
      c.var.database
        .select()
        .from(regulations)
        .where(where)
        .orderBy(asc(regulations.code))
        .limit(limit)
        .offset(offset),
      c.var.database.select({ total: count() }).from(regulations).where(where),
    ])

    // 各規程の最新版（version 最大）を 1 クエリで引いて突き合わせる。
    const latestByRegulationId = new Map<number, { version: number; effectiveOn: string }>()

    if (rows.length > 0) {
      const versionRows = await c.var.database
        .select({
          regulationId: regulationVersions.regulationId,
          version: regulationVersions.version,
          effectiveOn: regulationVersions.effectiveOn,
        })
        .from(regulationVersions)

      for (const versionRow of versionRows) {
        const current = latestByRegulationId.get(versionRow.regulationId)

        if (current === undefined || versionRow.version > current.version) {
          latestByRegulationId.set(versionRow.regulationId, {
            version: versionRow.version,
            effectiveOn: versionRow.effectiveOn,
          })
        }
      }
    }

    const responseBody = zAppRegulationList.parse({
      data: rows.map((row) => {
        const latest = latestByRegulationId.get(row.id) ?? null

        return {
          id: row.id,
          code: row.code,
          title: row.title,
          category: row.category,
          status: row.status,
          latest_version: latest === null ? null : latest.version,
          effective_on: latest === null ? null : latest.effectiveOn,
          created_at: row.createdAt,
        }
      }),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)

/** POST /regulations — 規程を初版付きで新規登録（regulation:manage）。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      title: z.string().min(1).max(500),
      category: z.string().max(200).nullable().optional(),
      body_md: z.string().min(1).max(50_000),
      effective_on: z.string().min(1).max(50),
      note: z.string().max(2_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const registered = await new RegisterRegulation(c).run({
      session: session,
      code: json.code,
      title: json.title,
      category: json.category ?? null,
      bodyMd: json.body_md,
      effectiveOn: json.effective_on,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (registered instanceof ApplicationError) {
      throw toHttpException(registered)
    }

    const responseBody = zAppRegulation.parse({
      id: registered.regulation.id,
      code: registered.regulation.code,
      title: registered.regulation.title,
      category: registered.regulation.category,
      status: registered.regulation.status,
      created_at: registered.regulation.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
