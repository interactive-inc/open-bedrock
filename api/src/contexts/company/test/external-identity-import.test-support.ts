import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { ApplyExternalIdentities } from "@/contexts/company/application/external-identities/apply-external-identities"
import { ExternalIdentityImportRepository } from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import type { ExternalIdentityImportInput } from "@/contexts/company/domain/entities/external-identity-import.entity"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.machine-sessions"
import { z } from "zod"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
export const EXTERNAL_IMPORT_TEST_SECRET = "external-import-test-signing-secret"

/** 両製品の実migrationと機械session発行を使うCompany同期fixture。 */
export async function createExternalIdentityImportTestContext(providerScope = "oidc") {
  const database = createCompanyD1TestDatabase(schemaSql)
  const now = new Date()
  const accountId = zAccountId.parse("external-import-service")
  const credentialId = "external-import-credential"
  const rawSecret = "1".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(rawSecret)
  if (hash instanceof Error) throw hash
  await database.exec(`
    INSERT INTO company_organizations (id, revision, name, representative_name, created_at, updated_at)
      SELECT 'organization:default', 0, 'Example organization', 'Example representative', 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM company_organizations WHERE id = 'organization:default');
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('external-import-service', 'active', 0, 0, 0);
    INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('external-import-principal', 'external-import-service', 'service', 'Directory synchronization', NULL, 1, 0, 0);
    INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
      VALUES ('import-global', 'custom:import-global', 'custom', NULL, 'Account grants', 0, 0),
        ('import-provider', 'custom:import-provider', 'custom', 'system:identity_provider', 'Provider writer', 0, 0),
        ('import-member', 'custom:import-member', 'custom', NULL, 'Imported member', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('import-global', 'iam:write'), ('import-global', 'org:read'), ('import-global', 'employee:read'),
        ('import-provider', 'account:manage'), ('import-provider', 'employee:write'),
        ('import-member', 'org:read'), ('import-member', 'employee:read');
    INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('import-global-binding', 'external-import-service', 'import-global', NULL, NULL, 0, NULL);
  `)
  await database
    .prepare(`INSERT INTO system_role_bindings
    (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
    VALUES ('import-provider-binding', 'external-import-service', 'import-provider', 'system:identity_provider', ?1, 0, NULL)`)
    .bind(providerScope)
    .run()
  await database
    .prepare(`INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at)
    VALUES (?1, 'external-import-principal', 'Primary', ?2, 'active', 0, 0)`)
    .bind(credentialId, hash)
    .run()
  const app = systemFactory.createApp().post("/system/machine-sessions", ...POST)
  const response = await app.request(
    "/system/machine-sessions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential_id: credentialId, secret: rawSecret }),
    },
    { DB: database, JWT_SECRET: EXTERNAL_IMPORT_TEST_SECRET, NOW: now.toISOString() },
  )
  if (response.status !== 201)
    throw new Error(`machine session failed: ${response.status} ${await response.text()}`)
  const token = z.object({ access_token: z.string() }).parse(await response.json()).access_token
  const revision = await database
    .prepare("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
    .first<number>("revision")
  if (revision === null) throw new Error("missing organization")
  const actor = { accountId, tokenVersion: 0, credentialId, issuedAtMs: now.getTime() }
  const clock = { at: now }
  const application = new ApplyExternalIdentities({
    repository: new ExternalIdentityImportRepository({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    }),
    actor,
    now: () => clock.at,
  })
  const input: ExternalIdentityImportInput = {
    commandId: "import:first",
    expectedRevision: revision,
    reason: "Confirmed directory update",
    identities: [
      {
        subject: "external-person-1",
        sourceRevision: 1,
        email: "you@example.com",
        name: "Example Person",
        accountId: null,
        initialRoleId: iamRoleIdSchema.parse("import-member"),
        newEmployee: { hireDate: "2026-01-01", employmentType: "PART_TIME" },
      },
    ],
  }
  return { database, actor, token, clock, application, input }
}
