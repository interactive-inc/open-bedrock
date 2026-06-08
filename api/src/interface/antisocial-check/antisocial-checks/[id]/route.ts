import { CancelAntisocialCheck } from "@/application/antisocial-check/cancel-antisocial-check"
import { GetAntisocialCheck } from "@/application/antisocial-check/get-antisocial-check"
import { UpdateAntisocialCheck } from "@/application/antisocial-check/update-antisocial-check"
import type { AntisocialCheck } from "@/domain/antisocial-check/antisocial-check"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 反社チェック申請をレスポンス用の snake_case に整形する。
function toResponseBody(antisocialCheck: AntisocialCheck) {
  return {
    id: antisocialCheck.id,
    requester_id: antisocialCheck.requesterId,
    partner_name: antisocialCheck.partnerName,
    partner_address: antisocialCheck.partnerAddress,
    representative_name: antisocialCheck.representativeName,
    result: antisocialCheck.result,
    status: antisocialCheck.status,
    created_at: antisocialCheck.createdAt,
  }
}

// GET /antisocial-checks/:id — 反社チェック申請の詳細（本人のみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const antisocialCheck = await new GetAntisocialCheck(c).run({
    antisocialCheckId: c.req.param("id") ?? "",
    requesterId: viewer.employeeId,
  })

  if (antisocialCheck instanceof Error) {
    throw new InternalError("failed to load antisocial check")
  }

  if ("reason" in antisocialCheck) {
    if (antisocialCheck.reason === "antisocial_check_not_found") {
      throw new NotFoundError("antisocial check not found")
    }

    throw new ForbiddenError("not the requester")
  }

  return c.json(toResponseBody(antisocialCheck), 200)
})

// PUT /antisocial-checks/:id — 反社チェック申請の内容を変更（本人のみ）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      partner_name: z.string().min(1).max(500),
      partner_address: z.string().max(500).nullable().optional(),
      representative_name: z.string().max(200).nullable().optional(),
      result: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const antisocialCheck = await new UpdateAntisocialCheck(c).run({
      antisocialCheckId: c.req.param("id") ?? "",
      requesterId: viewer.employeeId,
      partnerName: json.partner_name,
      partnerAddress: json.partner_address ?? null,
      representativeName: json.representative_name ?? null,
      result: json.result ?? null,
    })

    if (antisocialCheck instanceof Error) {
      throw new InternalError("failed to update antisocial check")
    }

    if ("reason" in antisocialCheck) {
      if (antisocialCheck.reason === "antisocial_check_not_found") {
        throw new NotFoundError("antisocial check not found")
      }

      throw new ForbiddenError("not the requester")
    }

    return c.json(toResponseBody(antisocialCheck), 200)
  },
)

// DELETE /antisocial-checks/:id — 反社チェック申請を取消（本人のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new CancelAntisocialCheck(c).run({
    antisocialCheckId: c.req.param("id") ?? "",
    requesterId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel antisocial check")
  }

  if (result.reason === "antisocial_check_not_found") {
    throw new NotFoundError("antisocial check not found")
  }

  if (result.reason === "not_requester") {
    throw new ForbiddenError("not the requester")
  }

  return c.body(null, 204)
})
