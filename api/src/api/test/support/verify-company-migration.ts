import { BackfillLifecycleMigration } from "@/contexts/company-compatibility/application/employee-lifecycle/backfill-lifecycle-migration"
import { PreflightLifecycleMigration } from "@/contexts/company-compatibility/application/employee-lifecycle/preflight-lifecycle-migration"
import { VerifyLifecycleMigration } from "@/contexts/company-compatibility/application/employee-lifecycle/verify-lifecycle-migration"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { schema } from "@/schema"
import { drizzle } from "drizzle-orm/d1"

/** 旧fixtureを本番と同じCompany migrationでcanonical lifecycleへ変換する。 */
export async function verifyCompanyMigration(db: D1Database): Promise<void> {
  const context: Context = {
    var: {
      database: drizzle(db, { schema }),
      session: null,
      auditContext: {
        requestId: "00000000-0000-4000-8000-000000000000",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
    env: {
      DB: db,
      JWT_SECRET: "company-migration-test-secret",
      AUDIT_HMAC_SECRET: "company-migration-test-audit-secret",
      COMPANY_TIME_ZONE: "Asia/Tokyo",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  }
  const input = { baselineOn: "2025-01-01", timeZone: "Asia/Tokyo" }
  const preflight = await new PreflightLifecycleMigration(context).run(input)
  if (preflight instanceof ApplicationError || preflight.issues.length > 0) {
    throw new Error("Company migration preflight failed", { cause: preflight })
  }
  const command = { ...input, legacySourceFingerprint: preflight.legacySourceFingerprint }
  const backfilled = await new BackfillLifecycleMigration(context).run(command)
  if (backfilled instanceof ApplicationError) {
    throw new Error("Company migration backfill failed", { cause: backfilled })
  }
  const verified = await new VerifyLifecycleMigration(context).run(command)
  if (verified instanceof ApplicationError) {
    throw new Error("Company migration verification failed", { cause: verified })
  }
}
