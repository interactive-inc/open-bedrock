import { UnexpectedError } from "@/lib/errors"
import { CareerSheetRepository } from "@/contexts/career/infrastructure/career-sheet.repository"

import { UpdateMyCareerSheet } from "@/contexts/career/application/update-my-career-sheet"
import { careerSheets } from "@/contexts/career/infrastructure/schema/career"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { zAppCareerSheet } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /career-sheets/me — 本人のキャリアシート（未登録なら空のシート） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select()
    .from(careerSheets)
    .where(eq(careerSheets.employeeId, session.employeeId))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    const emptyBody = zAppCareerSheet.parse({
      employee_id: session.employeeId,
      goals_text: null,
      strengths_text: null,
      updated_at: null,
    })

    return c.json(emptyBody, 200)
  }

  const responseBody = zAppCareerSheet.parse({
    employee_id: row.employeeId,
    goals_text: row.goalsText,
    strengths_text: row.strengthsText,
    updated_at: row.updatedAt,
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** DELETE /career-sheets/me — 本人のキャリアシートを削除（未登録でも 204） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const result = await (async () => {
    const command = {
      employeeId: session.employeeId,
    }

    const repository = new CareerSheetRepository(c)

    const deleted = await repository.deleteByEmployeeId(command.employeeId)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete career sheet", { cause: deleted })
    }

    return { reason: "cleared" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /career-sheets/me — 本人のキャリアシートを登録・更新 */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      goals_text: z.string().max(5_000).nullable().optional(),
      strengths_text: z.string().max(5_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const updated = await new UpdateMyCareerSheet(c).run({
      employeeId: session.employeeId,
      goalsText: json.goals_text ?? null,
      strengthsText: json.strengths_text ?? null,
      now: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppCareerSheet.parse({
      employee_id: updated.employeeId,
      goals_text: updated.goalsText,
      strengths_text: updated.strengthsText,
      updated_at: updated.updatedAt,
    })

    return c.json(responseBody, 200)
  },
)
