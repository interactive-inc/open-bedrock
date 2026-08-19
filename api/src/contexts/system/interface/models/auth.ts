import { z } from "zod"

export const zAppMcpGrantResponse = z.object({
  item: z.object({ grant: z.string() }).nullable(),
  error: z.string().optional(),
})

/**
 * アカウント切替と MCP grant 交換の応答に載る本人確認情報。
 * 権限・スコープを意図的に含めない。呼び出し側は GET /api/auth/session を
 * 引き直すまで権限を空として扱い、前アカウントの権限を持ち越さない (#867)。
 */
export const zAppReauthenticatedUser = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
})

export const zAppMcpGrantExchangeResponse = z.object({
  item: z.object({ user: zAppReauthenticatedUser }),
})

/** 副作用の完了だけを伝える応答。パスワード変更・再設定受付が使う。 */
export const zAppAuthAcknowledgement = z.object({
  item: z.object({ ok: z.literal(true) }),
})

/**
 * ログアウトの応答。switchedTo は残アカウントへ切り替わったときだけ true、
 * 完全ログアウト時は null (#873)。
 */
export const zAppLogoutResponse = z.object({
  item: z.object({
    ok: z.literal(true),
    switchedTo: z.literal(true).nullable(),
  }),
})

export const zAppOidcAuthorizationResponse = z.strictObject({
  redirect_uri: z.url(),
})
