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
import { onboardingTemplates, onboardingTemplateTasks } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"

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

  const templateRows = await c.var.database
    .select()
    .from(onboardingTemplates)
    .where(kind === undefined ? undefined : eq(onboardingTemplates.kind, kind))

  const taskRows = await c.var.database.select().from(onboardingTemplateTasks)

  const body = templateRows.map((template) => ({
    code: template.code,
    name: template.name,
    kind: template.kind,
    description: template.description,
    task_count: taskRows.filter((task) => task.templateCode === template.code).length,
  }))

  return c.json(body, 200)
})

// POST /onboarding/templates — テンプレートを新規作成（管理権限のみ）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      code: z.string().min(1),
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
