import { PublishShiftAssignment } from "@/contexts/company/application/shift/publish-shift-assignment"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppShiftAssignment } from "@/lib/app-schemas"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"

// @authorization service - session を application service に渡して判定する
/** POST /shift-assignments/:id/publish — 特権ロールが未公開の割当を公開する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const assignmentId = validateIntParam(c.req.param("id"), "shift assignment")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignment = await new PublishShiftAssignment(c).run({
    session: session,
    assignmentId,
    publishedAt: c.env.NOW ?? new Date().toISOString(),
  })

  if (assignment instanceof ApplicationError) {
    throw toHttpException(assignment)
  }

  const responseBody = zAppShiftAssignment.parse({
    id: assignment.id,
    employee_id: assignment.employeeId,
    pattern_id: assignment.patternId,
    date: assignment.date,
    note: assignment.note,
    published_at: assignment.publishedAt,
  })

  return c.json(responseBody, 200)
})
