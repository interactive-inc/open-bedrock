import { DecideApplication } from "@/application/application/decide-application"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { toApplicationId } from "@/domain/application/to-application-id"
import { zValidator } from "@hono/zod-validator"
import {
  BadRequestError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().min(1),
    }),
  ),
  async (c) => {
    const applicationId = toApplicationId(c.req.param("id") ?? "")

    if (applicationId === null) {
      throw new BadRequestError("invalid application id")
    }

    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const updated = await new DecideApplication(c).run({
      applicationId: applicationId,
      approverId: session.employeeId,
      action: "reject",
      comment: body.comment,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof Error) {
      throw new InternalError("failed to reject application")
    }

    if ("reason" in updated) {
      throw new NotFoundError("application not found")
    }

    return c.json({ status: updated.status }, 200)
  },
)
