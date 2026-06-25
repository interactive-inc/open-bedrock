import { PublishShiftAssignment } from "@/application/shift/publish-shift-assignment"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppShiftAssignment } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"

// POST /shift/assignments/:id/publish — 特権ロールが未公開の割当を公開する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const assignmentId = validateIntParam(c.req.param("id"), "shift assignment")

  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const assignment = await new PublishShiftAssignment(c).run({
    viewerRole: session.role,
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
