import { CreateCertificateRequest } from "@/application/certificate-request/create-certificate-request"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/lib/factory"
import { zAppCertificateRequest } from "@/lib/app-schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      certificate_type: z.string().min(1).max(200),
      submit_to: z.string().max(500).nullable().optional(),
      needed_by: isoDate.nullable().optional(),
      note: z.string().max(3_000).nullable().optional(),
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

    if (certificateRequest instanceof ApplicationError) {
      throw toHttpException(certificateRequest)
    }

    const responseBody = zAppCertificateRequest.parse({
      id: certificateRequest.id,
      requester_id: certificateRequest.requesterId,
      certificate_type: certificateRequest.certificateType,
      submit_to: certificateRequest.submitTo,
      needed_by: certificateRequest.neededBy,
      note: certificateRequest.note,
      status: certificateRequest.status,
      created_at: certificateRequest.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
