import { CreateRentalReservation } from "@/contexts/rental/application/create-rental-reservation"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { isoDate } from "@/lib/schemas"
import { zAppRentalReservation } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        item_name: z.string().min(1).max(500),
        start_date: isoDate,
        end_date: isoDate,
        purpose: z.string().max(3_000).nullable().optional(),
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

    const reservation = await new CreateRentalReservation(c).run({
      requesterId: viewer.employeeId,
      itemName: json.item_name,
      startDate: json.start_date,
      endDate: json.end_date,
      purpose: json.purpose ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (reservation instanceof ApplicationError) {
      throw toHttpException(reservation)
    }

    const responseBody = zAppRentalReservation.parse({
      id: reservation.id,
      requester_id: reservation.requesterId,
      item_name: reservation.itemName,
      start_date: reservation.startDate,
      end_date: reservation.endDate,
      purpose: reservation.purpose,
      status: reservation.status,
      created_at: reservation.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
