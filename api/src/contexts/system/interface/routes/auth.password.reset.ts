import { RequestPasswordReset } from "@/contexts/system/application/auth/request-password-reset"
import { EmailValue } from "@/contexts/system/domain/auth/email.value"
import { identitySubjectSchema } from "@/contexts/system/domain/identity/identity-subject"
import { systemFactory } from "@/contexts/system/interface/http/system-factory"
import { zAppAuthAcknowledgement } from "@/contexts/system/interface/models/auth"
import { userIdentities, users } from "@/contexts/system/infrastructure/schema/system-runtime"
import { zValidator } from "@hono/zod-validator"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

/** パスワード再設定メールの受付。 */
// @authorization public - Accountの実在を漏らさず常に同じ受付結果を返す
export const POST = systemFactory.createHandlers(
  zValidator(
    "json",
    z.object({
      email: EmailValue.schema.pipe(identitySubjectSchema),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")
    const action = new RequestPasswordReset(c)
    const clientIp = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null
    const accepted = await action.accept(body.email, clientIp)
    const identity = accepted
      ? (
          await c.var.database
            .select({
              id: userIdentities.id,
              email: userIdentities.email,
              canReceiveEmail: userIdentities.canReceiveEmail,
              user: { id: users.id, disabledAt: users.disabledAt },
            })
            .from(userIdentities)
            .innerJoin(users, eq(users.id, userIdentities.userId))
            .where(
              and(
                eq(userIdentities.provider, "password"),
                eq(userIdentities.providerSubject, body.email),
              ),
            )
            .limit(1)
        )[0]
      : undefined
    const recipient =
      identity?.canReceiveEmail === true &&
      identity.email !== null &&
      identity.user !== null &&
      identity.user.disabledAt === null
        ? { userId: identity.user.id, identityId: identity.id, email: identity.email }
        : null

    const result = await action.execute({
      email: body.email,
      origin: new URL(c.req.url).origin,
      recipient,
    })

    if (result instanceof Error) {
      throw result
    }

    return c.json(zAppAuthAcknowledgement.parse({ item: result }))
  },
)
