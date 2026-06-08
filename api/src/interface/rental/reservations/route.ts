import { CreateRentalReservation } from "@/application/rental/create-rental-reservation"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      item_name: z.string().min(1),
      start_date: isoDate,
      end_date: isoDate,
      purpose: z.string().nullable().optional(),
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

    if (reservation instanceof Error) {
      throw new InternalError("failed to create reservation")
    }

    const responseBody = {
      id: reservation.id,
      requester_id: reservation.requesterId,
      item_name: reservation.itemName,
      start_date: reservation.startDate,
      end_date: reservation.endDate,
      purpose: reservation.purpose,
      status: reservation.status,
      created_at: reservation.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
