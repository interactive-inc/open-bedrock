import { CreateAntisocialCheck } from "@/application/antisocial-check/create-antisocial-check"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppAntisocialCheck } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      partner_name: z.string().min(1).max(500),
      partner_address: z.string().max(500).nullable().optional(),
      representative_name: z.string().max(200).nullable().optional(),
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

    if (antisocialCheck instanceof ApplicationError) {
      throw toHttpException(antisocialCheck)
    }

    const responseBody = zAppAntisocialCheck.parse({
      id: antisocialCheck.id,
      requester_id: antisocialCheck.requesterId,
      partner_name: antisocialCheck.partnerName,
      partner_address: antisocialCheck.partnerAddress,
      representative_name: antisocialCheck.representativeName,
      result: antisocialCheck.result,
      status: antisocialCheck.status,
      created_at: antisocialCheck.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
