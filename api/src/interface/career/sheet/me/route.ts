import { DeleteMyCareerSheet } from "@/application/career/delete-my-career-sheet"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { careerSheets } from "@/schema"
import { eq } from "drizzle-orm"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppCareerSheet } from "@/lib/app-schemas"

// GET /career/sheet/me — 本人のキャリアシート（未登録なら空のシート）
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
      employee_id: String(session.employeeId),
      goals_text: null,
      strengths_text: null,
      updated_at: null,
    })

    return c.json(emptyBody, 200)
  }

  const responseBody = zAppCareerSheet.parse({
    employee_id: String(row.employeeId),
    goals_text: row.goalsText,
    strengths_text: row.strengthsText,
    updated_at: row.updatedAt,
  })

  return c.json(responseBody, 200)
})

// DELETE /career/sheet/me — 本人のキャリアシートを削除（未登録でも 204）
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
