import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { BadRequestError, UnauthorizedError } from "@/interface/lib/errors"
import { onboardingTemplates, onboardingTemplateTasks } from "@/schema"
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
