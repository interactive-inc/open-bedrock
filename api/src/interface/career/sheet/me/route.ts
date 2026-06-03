import { DeleteMyCareerSheet } from "@/application/career/delete-my-career-sheet"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { careerSheets } from "@/schema"
import { eq } from "drizzle-orm"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"

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
    return c.json(
      {
        employee_id: session.employeeId,
        goals_text: null,
        strengths_text: null,
        updated_at: null,
      },
      200,
    )
  }

  const responseBody = {
    employee_id: row.employeeId,
    goals_text: row.goalsText,
    strengths_text: row.strengthsText,
    updated_at: row.updatedAt,
  }

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

  if (result instanceof Error) {
    throw new InternalError("failed to delete career sheet")
  }

  return c.body(null, 204)
})
