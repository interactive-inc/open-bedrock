import { CreateAntisocialCheck } from "@/application/antisocial-check/create-antisocial-check"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      partner_name: z.string().min(1),
      partner_address: z.string().nullable().optional(),
      representative_name: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const antisocialCheck = await new CreateAntisocialCheck(c).run({
      requesterId: viewer.employeeId,
      partnerName: json.partner_name,
      partnerAddress: json.partner_address ?? null,
      representativeName: json.representative_name ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (antisocialCheck instanceof Error) {
      throw new InternalError("failed to create antisocial check")
    }

    const responseBody = {
      id: antisocialCheck.id,
      requester_id: antisocialCheck.requesterId,
      partner_name: antisocialCheck.partnerName,
      partner_address: antisocialCheck.partnerAddress,
      representative_name: antisocialCheck.representativeName,
      result: antisocialCheck.result,
      status: antisocialCheck.status,
      created_at: antisocialCheck.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
