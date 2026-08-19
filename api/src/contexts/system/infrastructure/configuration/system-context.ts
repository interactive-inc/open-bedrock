import * as systemSchema from "@system/infrastructure/schema/system"
import type { OidcClientRegistry } from "@system/domain/identity/oidc-client.policy"
import type { OidcIssuerConfiguration } from "@system/domain/identity/oidc.value"
import type { DrizzleD1Database } from "drizzle-orm/d1"

type SystemDrizzleDatabase = DrizzleD1Database<typeof systemSchema>

/** System Infrastructureが利用できる、relation queryを除いたDrizzle操作。 */
export type SystemDatabase = Pick<
  SystemDrizzleDatabase,
  "batch" | "delete" | "insert" | "select" | "update"
>

export type SystemDatabaseContext = Readonly<{
  var: Readonly<{ database: SystemDatabase }>
}>

export type SystemD1Context = Readonly<{
  env: Readonly<{ DB: D1Database }>
}>

export type SystemClockContext = Readonly<{
  var: Readonly<{ now: () => Date }>
}>

export type SystemAuthorizationContext = Readonly<{
  var: Readonly<{
    accountTokenVersion: number
    permissions: ReadonlySet<string>
    role: string
    userId: string
  }>
}>

export type SystemRequestAudit = Readonly<{
  requestId: string
  clientName: "web" | "cli" | "api" | "system"
  clientIp: string | null
  externalRequestId: string | null
}>

export type SystemRequestAuditContext = Readonly<{
  var: Readonly<{ auditContext: SystemRequestAudit }>
}>

export type SystemJwtSecretContext = Readonly<{
  env: Readonly<{ JWT_SECRET?: string }>
}>

export type SystemOidcSigningContext = Readonly<{
  env: Readonly<{ OIDC_SIGNING_KEYS?: string }>
}>

export type SystemOidcConfigurationContext = Readonly<{
  var: Readonly<{
    oidcClientRegistry: OidcClientRegistry
    oidcIssuerConfiguration: OidcIssuerConfiguration
  }>
}>

export type SystemPasswordHashContext = Readonly<{
  env: Readonly<{ PEPPER_SECRET?: string }>
}>

export type SystemBootstrapContext = Readonly<{
  env: Readonly<{ BOOTSTRAP_TOKEN?: string }>
}>

type SystemEmailAddress = Readonly<{
  name: string
  email: string
}>

type SystemEmailMessage = Readonly<{
  from: string | SystemEmailAddress
  to: string | SystemEmailAddress | ReadonlyArray<string | SystemEmailAddress>
  subject: string
  replyTo?: string | SystemEmailAddress
  cc?: string | SystemEmailAddress | ReadonlyArray<string | SystemEmailAddress>
  bcc?: string | SystemEmailAddress | ReadonlyArray<string | SystemEmailAddress>
  headers?: Readonly<Record<string, string>>
  text?: string
  html?: string
}>

export type SystemEmailSender = Readonly<{
  send(message: SystemEmailMessage): Promise<unknown>
}>

export type SystemEmailContext = Readonly<{
  env: Readonly<{
    EMAIL?: SystemEmailSender
    EMAIL_SENDER_NAME?: string
    INVITE_EMAIL_FROM?: string
    INVITE_EMAIL_SEND_ENABLED?: string
  }>
}>
