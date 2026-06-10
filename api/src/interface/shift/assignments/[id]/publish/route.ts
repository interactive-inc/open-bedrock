import { PublishShiftAssignment } from "@/application/shift/publish-shift-assignment"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
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

  if (assignment instanceof Error) {
    throw new InternalError("failed to publish assignment")
  }

  if ("reason" in assignment) {
    if (assignment.reason === "forbidden") {
      throw new ForbiddenError()
    }

    if (assignment.reason === "already_published") {
      throw new ConflictError("already published")
    }

    throw new NotFoundError("assignment not found")
  }

  const responseBody = {
    id: assignment.id,
    employee_id: assignment.employeeId,
    pattern_id: assignment.patternId,
    date: assignment.date,
    note: assignment.note,
    published_at: assignment.publishedAt,
  }

  return c.json(responseBody, 200)
})
