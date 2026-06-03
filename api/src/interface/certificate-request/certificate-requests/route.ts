import { CreateCertificateRequest } from "@/application/certificate-request/create-certificate-request"
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
      certificate_type: z.string().min(1),
      submit_to: z.string().nullable().optional(),
      needed_by: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const certificateRequest = await new CreateCertificateRequest(c).run({
      requesterId: viewer.employeeId,
      certificateType: json.certificate_type,
      submitTo: json.submit_to ?? null,
      neededBy: json.needed_by ?? null,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (certificateRequest instanceof Error) {
      throw new InternalError("failed to create certificate request")
    }

    const responseBody = {
      id: certificateRequest.id,
      requester_id: certificateRequest.requesterId,
      certificate_type: certificateRequest.certificateType,
      submit_to: certificateRequest.submitTo,
      needed_by: certificateRequest.neededBy,
      note: certificateRequest.note,
      status: certificateRequest.status,
      created_at: certificateRequest.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
