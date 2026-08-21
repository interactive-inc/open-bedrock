import { ConflictError } from "@/lib/errors"
import { AntisocialCheckRepository } from "@/contexts/antisocial-check/infrastructure/antisocial-check.repository"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { UpdateAntisocialCheck } from "@/contexts/antisocial-check/application/update-antisocial-check"
import type { AntisocialCheck } from "@/contexts/antisocial-check/domain/entities/antisocial-check.entity"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppAntisocialCheck } from "@/lib/app-schemas"
import { validateUuidParam } from "@/lib/http/validate-uuid-param"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 反社チェック申請をレスポンス用の snake_case に整形し、スキーマで検証する。 */
function toResponseBody(antisocialCheck: AntisocialCheck) {
  return zAppAntisocialCheck.parse({
    id: antisocialCheck.id,
    requester_id: antisocialCheck.requesterId,
    partner_name: antisocialCheck.partnerName,
    partner_address: antisocialCheck.partnerAddress,
    representative_name: antisocialCheck.representativeName,
    result: antisocialCheck.result,
    status: antisocialCheck.status,
    created_at: antisocialCheck.createdAt,
  })
}

// @authorization service - session を application service に渡して判定する
/** GET /antisocial-checks/:id — 反社チェック申請の詳細（本人のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const antisocialCheck = await (async () => {
    const command = {
      antisocialCheckId: validateUuidParam(c.req.param("id"), "antisocial check"),
      session: viewer,
    }

    const antisocialCheckRepository = new AntisocialCheckRepository(c)

    const antisocialCheck = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (antisocialCheck instanceof Error) {
      return new UnexpectedError("failed to find antisocial check", { cause: antisocialCheck })
    }

    if (antisocialCheck === null) {
      return new NotFoundError("antisocial check not found", "antisocial_check_not_found")
    }

    if (
      antisocialCheck.requesterId !== command.session.employeeId &&
      command.session.hasPermission("antisocial_check:manage") === false
    ) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    return antisocialCheck
  })()

  if (antisocialCheck instanceof ApplicationError) {
    throw toHttpException(antisocialCheck)
  }

  return c.json(toResponseBody(antisocialCheck), 200)
})

// @authorization service - session を application service に渡して判定する
/** PUT /antisocial-checks/:id — 反社チェック申請の内容を変更（本人のみ） */
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
      antisocialCheckId: validateUuidParam(c.req.param("id"), "antisocial check"),
      session: viewer,
      partnerName: json.partner_name,
      partnerAddress: json.partner_address ?? null,
      representativeName: json.representative_name ?? null,
      result: json.result ?? null,
    })

    if (antisocialCheck instanceof ApplicationError) {
      throw toHttpException(antisocialCheck)
    }

    return c.json(toResponseBody(antisocialCheck), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /antisocial-checks/:id — 反社チェック申請を取消（本人のみ） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await (async () => {
    const command = {
      antisocialCheckId: validateUuidParam(c.req.param("id"), "antisocial check"),
      requesterId: viewer.employeeId,
    }

    const antisocialCheckRepository = new AntisocialCheckRepository(c)

    const current = await antisocialCheckRepository.findById(command.antisocialCheckId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find antisocial check", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("antisocial check not found", "antisocial_check_not_found")
    }

    if (current.requesterId !== command.requesterId) {
      return new ForbiddenError("not the requester", "not_requester")
    }

    if (current.status !== "requested") {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    const deleted = await antisocialCheckRepository.delete(command.antisocialCheckId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete antisocial check", { cause: deleted })
    }

    if (deleted === null) {
      return new ConflictError("antisocial check is not modifiable", "not_modifiable")
    }

    return { reason: "cancelled" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
