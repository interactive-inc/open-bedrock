import { z } from "zod"
import { createClient } from "@/lib/api/hc-client"

const identityLoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().nullable().optional(),
})

/**
 * POST /auth/identity/login。外部 identity provider が発行した短命トークンを
 * サーバーサイドで交換し、アクセストークンを取得する。未認証フローで呼ばれる。
 * アカウント未登録（404）は "account_not_found" の Error として区別して返す。
 */
export async function postIdentityLogin(body: { token: string }) {
  const client = await createClient()

  const response = await client.auth.identity.login.$post({ json: body })

  if (response.status === 404) {
    return new Error("account_not_found")
  }

  if (response.status >= 400) {
    return new Error("failed to login")
  }

  const parsed = identityLoginResponseSchema.safeParse(await response.json())

  if (parsed.success === false) {
    return new Error("failed to login")
  }

  return {
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token ?? null,
  }
}
