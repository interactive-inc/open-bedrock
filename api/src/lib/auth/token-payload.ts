import { z } from "zod"

// access token の claims。permission/role/email は載せない(改竄面とスナップショット陳腐化を消す)。
// 認可は verify-bearer が毎回 DB 解決し、tokenVersion でアカウント単位の即時失効を判定する。
export const tokenPayloadSchema = z.object({
  accountId: z.number(),
  employeeId: z.number(),
  tokenVersion: z.number(),
})

export type TokenPayload = z.infer<typeof tokenPayloadSchema>
