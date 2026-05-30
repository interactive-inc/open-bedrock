import type { Context } from "@/env"
import { schema } from "@/schema"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { drizzle } from "drizzle-orm/d1"

// テスト用: スキーマを流し込んだインメモリ D1 と Drizzle を載せた Context を作る。
// リポジトリ（new XxxRepository(context)）を直接叩くために使う。
export function createTestContext(): { context: Context; db: D1Database } {
  const db = createD1TestDatabase(loadSchema())

  const context: Context = {
    var: {
      database: drizzle(db, { schema }),
      session: null,
    },
    env: {
      DB: db,
      JWT_SECRET: "repository-test-secret",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  }

  return { context, db }
}
