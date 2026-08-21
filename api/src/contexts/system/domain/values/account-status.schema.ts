import { z } from "zod"

/**
 * System AccountEntity の認証可否を表す状態。
 *
 * suspended は管理上の停止、locked は認証上の保護を表す。どちらもSessionを拒否するが、
 * 状態を分けて保持することで解除主体・監査理由・将来の復旧手順を混同しない。
 */
export const accountStatusSchema = z.enum(["active", "suspended", "locked"])

export type AccountStatus = z.infer<typeof accountStatusSchema>
