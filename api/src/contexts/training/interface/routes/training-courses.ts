import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { CreateTrainingCourse } from "@/contexts/training/application/create-training-course"
import { trainingCourses } from "@/contexts/training/infrastructure/schema/training"
import { zAppTrainingCourse, zAppTrainingCourseList } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { codeSchema } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { and, asc, count, eq, type SQL } from "drizzle-orm"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      title: z.string().min(1).max(500),
      category: z.string().min(1).max(200),
      description: z.string().max(3_000).optional(),
      duration_minutes: z.number().int().positive().optional(),
      is_required: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await new CreateTrainingCourse(c).run({
      session: session,
      code: body.code,
      title: body.title,
      category: body.category,
      description: body.description ?? null,
      durationMinutes: body.duration_minutes ?? null,
      isRequired: body.is_required ?? false,
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppTrainingCourse.parse({
      id: created.id,
      code: created.code,
      title: created.title,
      description: created.description,
      duration_minutes: created.durationMinutes,
      category: created.category,
      is_required: created.isRequired,
      status: created.status,
    })

    return c.json(responseBody, 201)
  },
)

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      category: z.string().optional(),
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

    if (query.category !== undefined) {
      conditions.push(eq(trainingCourses.category, query.category))
    }

    if (query.status !== undefined) {
      conditions.push(eq(trainingCourses.status, query.status))
    }

    const rows = await c.var.database
      .select()
      .from(trainingCourses)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(asc(trainingCourses.id))
      .limit(limit)
      .offset(offset)

    const totalRows = await c.var.database
      .select({ total: count() })
      .from(trainingCourses)
      .where(conditions.length === 0 ? undefined : and(...conditions))

    const responseBody = zAppTrainingCourseList.parse({
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        description: row.description,
        duration_minutes: row.durationMinutes,
        category: row.category,
        is_required: row.isRequired,
        status: row.status,
      })),
      total: totalRows.at(0)?.total ?? 0,
    })

    return c.json(responseBody, 200)
  },
)
