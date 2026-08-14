import { CreateBusinessTrip } from "@/contexts/company/application/business-trip/create-business-trip"
import { ApplicationError } from "@/lib/errors"
import { zAppBusinessTrip } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        destination: z.string().min(1).max(500),
        start_date: isoDate,
        end_date: isoDate,
        purpose: z.string().min(1).max(3_000),
        estimated_cost: z.number().int().nonnegative().nullable().optional(),
      })
      .refine((d) => d.start_date <= d.end_date, {
        message: "end_date must be on or after start_date",
        path: ["end_date"],
      }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const businessTrip = await new CreateBusinessTrip(c).run({
      travelerId: viewer.employeeId,
      destination: json.destination,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose,
      estimatedCost: json.estimated_cost ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (businessTrip instanceof ApplicationError) {
      throw toHttpException(businessTrip)
    }

    const responseBody = zAppBusinessTrip.parse({
      id: businessTrip.id,
      traveler_id: businessTrip.travelerId,
      destination: businessTrip.destination,
      start_date: businessTrip.startDate,
      end_date: businessTrip.endDate,
      purpose: businessTrip.purpose,
      estimated_cost: businessTrip.estimatedCost,
      status: businessTrip.status,
      created_at: businessTrip.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
