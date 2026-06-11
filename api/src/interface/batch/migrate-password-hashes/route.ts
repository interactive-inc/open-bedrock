import { MigrateLegacyHashes } from "@/application/batch/migrate-legacy-hashes"
import { canManageBatch } from "@/domain/batch/can-manage-batch"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// POST /batch/migrate-password-hashes — 旧形式ハッシュを PBKDF2 ラップに一括移行する
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManageBatch(session.role) === false) {
    throw new ForbiddenError()
  }

  const result = await new MigrateLegacyHashes(c).run()

  if (result instanceof Error) {
    throw new InternalError(result.message)
  }

  return c.json(result, 200)
})
