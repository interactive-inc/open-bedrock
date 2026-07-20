import { ProcessLifecycleOutbox } from "@/application/employee-lifecycle/process-lifecycle-outbox"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.strictObject({ limit: z.number().int().min(1).max(100).optional() })),
  async (c) => {
    if (c.var.session === null) throw new UnauthorizedError()
    const result = await new ProcessLifecycleOutbox(c).run({
      session: c.var.session,
      limit: c.req.valid("json").limit,
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return c.json(result, 200)
  },
)
