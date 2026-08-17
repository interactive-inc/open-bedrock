import { DeleteMyCareerSheet } from "@/contexts/career/application/delete-my-career-sheet"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { careerSheets } from "@/contexts/career/infrastructure/schema/career"
import { eq } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { zAppCareerSheet } from "@/lib/app-schemas"

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

  const result = await new DeleteMyCareerSheet(c).run({
    employeeId: session.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
