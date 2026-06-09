import { canManageBatch } from "@/domain/batch/can-manage-batch"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { batchJobs } from "@/schema"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManageBatch(session.role) === false) {
    throw new ForbiddenError()
  }

  const rows = await c.var.database.select().from(batchJobs).orderBy(batchJobs.id)

  const responseBody = rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    started_at: row.startedAt,
    finished_at: row.finishedAt,
    message: row.message,
  }))

  return c.json(responseBody, 200)
})
