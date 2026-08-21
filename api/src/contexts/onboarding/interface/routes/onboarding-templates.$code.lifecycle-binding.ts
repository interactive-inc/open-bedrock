import { UpdateLifecycleTemplateBinding } from "@/contexts/onboarding/application/update-lifecycle-template-binding"
import { RemoveLifecycleTemplateBinding } from "@/contexts/onboarding/application/remove-lifecycle-template-binding"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/api/http/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.strictObject({ effect_type: z.enum(["hire", "retired"]) })),
  async (c) => {
    if (c.var.session === null) throw new UnauthorizedError()
    const result = await new UpdateLifecycleTemplateBinding(c).run({
      session: c.var.session,
      templateCode: validateCodeParam(c.req.param("code"), "onboarding template"),
      effectType: c.req.valid("json").effect_type,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json({ effect_type: result.effectType, template_code: result.templateCode }, 200)
  },
)

// @authorization service - session を application service に渡して判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) throw new UnauthorizedError()
  const result = await new RemoveLifecycleTemplateBinding(c).run({
    session: c.var.session,
    templateCode: validateCodeParam(c.req.param("code"), "onboarding template"),
  })
  if (result instanceof ApplicationError) throw toHttpException(result)
  return c.body(null, 204)
})
