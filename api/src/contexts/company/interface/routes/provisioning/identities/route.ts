import { SyncExternalIdentities } from "@/contexts/company/application/iam/sync-external-identities"
import { identitySubjectSchema } from "@/contexts/system/domain/identity/identity-subject"
import { ApplicationError } from "@/lib/errors"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyProvisioningKey } from "@/contexts/company/interface/middlewares/verify-provisioning-key"
import { zAppProvisioningSummary } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { z } from "zod"

const identityInputSchema = z.object({
  subject: identitySubjectSchema,
  email: z.string().min(1).max(254),
  name: z.string().min(1).max(200),
})

// 単体 or 配列を受け付ける。単体は 1 件配列に正規化する。
const bodySchema = z.union([identityInputSchema, z.array(identityInputSchema).min(1).max(500)])

// @authorization machine - 機械用のキーで認証する
/**
 * POST /provisioning/identities — 外部 identity provider からの同期(プロビジョニング)を冪等に適用する。
 * 認証は machine API キー(PROVISIONING_API_KEY)。ユーザー Bearer とは独立。
 */
export const POST = factory.createHandlers(
  verifyProvisioningKey,
  zValidator("json", bodySchema),
  async (c) => {
    const json = c.req.valid("json")
    const inputs = Array.isArray(json) ? json : [json]

    const now = c.env.NOW === undefined ? new Date() : new Date(c.env.NOW)

    const result = await new SyncExternalIdentities(c).run(inputs, now)

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppProvisioningSummary.parse(result)

    return c.json(responseBody, 200)
  },
)
