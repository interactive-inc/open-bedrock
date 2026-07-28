import { CreateOnboardingTemplate } from "@/application/onboarding/create-onboarding-template"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppOnboardingTemplate, zAppOnboardingTemplateList } from "@/lib/app-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/utils/to-bounded-int"
import {
  lifecycleEffectTemplateBindings,
  onboardingTemplates,
  onboardingTemplateTasks,
} from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { count, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

const kindQuerySchema = z.enum(["join", "leave"]).optional()

// @authorization permission - 権限キーで判定する
/** GET /onboarding-templates — テンプレート一覧（kind で絞り込み可能） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("onboarding:manage") === false) {
    throw new ForbiddenError()
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

  const bindingRows =
    templateCodes.length === 0
      ? []
      : await c.var.database
          .select({
            templateCode: lifecycleEffectTemplateBindings.templateCode,
            effectType: lifecycleEffectTemplateBindings.effectType,
          })
          .from(lifecycleEffectTemplateBindings)
          .where(inArray(lifecycleEffectTemplateBindings.templateCode, templateCodes))

  const lifecycleEffectMap = new Map(
    bindingRows.map((row) => [row.templateCode, row.effectType] as const),
  )

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
    lifecycle_effect: lifecycleEffectMap.get(template.code) ?? null,
  }))

  const responseBody = zAppOnboardingTemplateList.parse({
    data: body,
    total: totalRows.at(0)?.total ?? 0,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /onboarding-templates — テンプレートを新規作成（管理権限のみ） */
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
      session: session,
      code: json.code,
      name: json.name,
      kind: json.kind,
      description: json.description ?? null,
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppOnboardingTemplate.parse({
      id: created.id,
      code: created.code,
      name: created.name,
      kind: created.kind,
      description: created.description,
    })

    return c.json(responseBody, 201)
  },
)
