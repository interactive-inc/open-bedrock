import { MigrateLegacyHashes } from "@/application/batch/migrate-legacy-hashes"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

/** POST /batch/migrate-password-hashes — 旧形式ハッシュを PBKDF2 ラップに一括移行する */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("batch:view") === false) {
    throw new ForbiddenError()
  }

  const result = await new MigrateLegacyHashes(c).run()

  if (result instanceof Error) {
    throw new InternalError("internal server error")
  }

  return c.json(result, 200)
})
