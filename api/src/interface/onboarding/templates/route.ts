import { CreateOnboardingTemplate } from "@/application/onboarding/create-onboarding-template"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { onboardingTemplates, onboardingTemplateTasks } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { count, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

const kindQuerySchema = z.enum(["join", "leave"]).optional()

// GET /onboarding/templates — テンプレート一覧（kind で絞り込み可能）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const parsed = kindQuerySchema.safeParse(c.req.query("kind"))

  if (parsed.success === false) {
    throw new BadRequestError("invalid kind")
  }

  const kind = parsed.data

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

  const templateRows = await c.var.database
    .select()
    .from(onboardingTemplates)
    .where(kind === undefined ? undefined : eq(onboardingTemplates.kind, kind))
    .limit(limit)
    .offset(offset)

  const templateCodes = templateRows.map((row) => row.code)

  const taskCountRows =
    templateCodes.length === 0
      ? []
      : await c.var.database
          .select({ templateCode: onboardingTemplateTasks.templateCode, total: count() })
          .from(onboardingTemplateTasks)
          .where(inArray(onboardingTemplateTasks.templateCode, templateCodes))
          .groupBy(onboardingTemplateTasks.templateCode)

  const taskCountMap = new Map(taskCountRows.map((row) => [row.templateCode, row.total]))

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(onboardingTemplates)
    .where(kind === undefined ? undefined : eq(onboardingTemplates.kind, kind))

  const body = templateRows.map((template) => ({
    code: template.code,
    name: template.name,
    kind: template.kind,
    description: template.description,
    task_count: taskCountMap.get(template.code) ?? 0,
  }))

  return c.json({ data: body, total: totalRows.at(0)?.total ?? 0 }, 200)
})

// POST /onboarding/templates — テンプレートを新規作成（管理権限のみ）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: codeSchema,
      name: z.string().min(1).max(500),
      kind: z.enum(["join", "leave"]),
      description: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateOnboardingTemplate(c).run({
      viewerRole: session.role,
      code: json.code,
      name: json.name,
      kind: json.kind,
      description: json.description ?? null,
    })

    if (created instanceof Error) {
      throw new InternalError("failed to create onboarding template")
    }

    if ("reason" in created) {
      if (created.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new ConflictError("template code already exists")
    }

    const responseBody = {
      id: created.id,
      code: created.code,
      name: created.name,
      kind: created.kind,
      description: created.description,
    }

    return c.json(responseBody, 201)
  },
)
