import { CreateShiftSwapRequest } from "@/application/shift/create-shift-swap-request"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /shift/swap-requests — 認証された本人がシフト交代を申請する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      target_employee_code: z.string().min(1),
      date: z.string().min(1),
      note: z.string().optional(),
    }),
  ),
  async (c) => {
    const request = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const swapRequest = await new CreateShiftSwapRequest(c).run({
      requesterEmployeeId: session.employeeId,
      targetEmployeeCode: request.target_employee_code,
      date: request.date,
      note: request.note ?? null,
    })

    if (swapRequest instanceof Error) {
      throw new InternalError("failed to create swap request")
    }

    if ("reason" in swapRequest) {
      throw new NotFoundError("target employee not found")
    }

    const responseBody = {
      id: swapRequest.id,
      requester_employee_id: swapRequest.requesterEmployeeId,
      target_employee_id: swapRequest.targetEmployeeId,
      date: swapRequest.date,
      note: swapRequest.note,
      status: swapRequest.status,
      approved_at: swapRequest.approvedAt,
    }

    return c.json(responseBody, 201)
  },
)
