import { InitializeCompanyTestState } from "@/api/test/support/company/initialize-company-test-state"
import { loadCompanyFixtureSnapshot } from "@/api/test/support/company/load-company-fixture-snapshot.repository"
import { VerifyCompanyTestState } from "@/api/test/support/company/verify-company-test-state"
import { initializeCanonicalCompanyOrganization } from "@/api/test/support/company/initialize-canonical-company-organization"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { schema } from "@/schema"
import { drizzle } from "drizzle-orm/d1"

/** 製品fixtureから、現在のcanonical Company状態を直接初期化して検証する。 */
export async function initializeCompanyTestState(db: D1Database): Promise<void> {
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
      JWT_SECRET: "company-initialization-test-secret",
      AUDIT_HMAC_SECRET: "company-initialization-test-audit-secret",
      COMPANY_TIME_ZONE: "Asia/Tokyo",
      NOW: "2026-01-01T00:00:00.000Z",
    },
  }
  const snapshot = await loadCompanyFixtureSnapshot(context)
  if (snapshot instanceof ApplicationError || snapshot.issues.length > 0) {
    throw new Error("Company fixture is invalid", { cause: snapshot })
  }
  const command = {
    baselineOn: "2025-01-01",
    timeZone: "Asia/Tokyo",
    sourceFingerprint: snapshot.fingerprint,
  }
  const initialized = await new InitializeCompanyTestState(context).run(command)
  if (initialized instanceof ApplicationError) {
    throw new Error("Company test state initialization failed", { cause: initialized })
  }
  await initializeCanonicalCompanyOrganization(db, command.baselineOn)
  const verified = await new VerifyCompanyTestState(context).run(command)
  if (verified instanceof ApplicationError) {
    throw new Error("Company test state verification failed", { cause: verified })
  }
}
