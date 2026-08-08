import { z } from "zod"

/**
 * 新規 access token の署名前入力。Employee や permission は token に含めず、認証後に DB から解決する。
 */
export const tokenPayloadSchema = z.object({
  accountId: z.number(),
  tokenVersion: z.number(),
})

export type TokenPayload = z.infer<typeof tokenPayloadSchema>

/** 移行前に発行した access token の payload。既存 token の有効期限内だけ検証に使う。 */
export const legacyTokenPayloadSchema = z.object({
  accountId: z.number(),
  employeeId: z.number(),
  tokenVersion: z.number(),
})
