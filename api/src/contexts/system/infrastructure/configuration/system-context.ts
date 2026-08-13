import * as systemSchema from "@system/infrastructure/schema/system"
import type { DrizzleD1Database } from "drizzle-orm/d1"

type SystemDrizzleDatabase = DrizzleD1Database<typeof systemSchema>

/**
 * System の永続化実装が利用できる Drizzle 操作。
 *
 * `query` は統合 schema の relation 型を System に漏らすため公開しない。必要な JOIN は
 * Infrastructure 内で明示し、System 単独 schema と製品の統合 schema のどちらも受け取れるようにする。
 */
export type SystemDatabase = Pick<
  SystemDrizzleDatabase,
  "batch" | "delete" | "insert" | "select" | "update"
>

export type SystemRequestAuditContext = Readonly<{
  requestId: string
  clientName: "web" | "cli" | "api" | "system"
  clientIp: string | null
  externalRequestId: string | null
}>

/**
 * System がリクエスト単位で必要とする最小の実行時依存。
 *
 * API 全体の Context や下位コンテキストの型を参照せず、System 自身の Drizzle schema、
 * D1 binding、監査用メタデータだけを公開する。製品側の Context は構造的部分型としてこの契約を満たす。
 */
export type SystemContext = Readonly<{
  var: Readonly<{
    database: SystemDatabase
    auditContext: SystemRequestAuditContext
  }>
  env: Readonly<{
    DB: D1Database
  }>
}>
