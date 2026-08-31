import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { Hono } from "hono"
import * as accounts from "@system/interface/routes/system.accounts"
import * as accountsAccountId from "@system/interface/routes/system.accounts.$accountId"
import * as accountsAccountIdIdentities from "@system/interface/routes/system.accounts.$accountId.identities"
import * as accountsAccountIdIdentitiesIdentityId from "@system/interface/routes/system.accounts.$accountId.identities.$identityId"
import * as accountsAccountIdPasswordCredentials from "@system/interface/routes/system.accounts.$accountId.password-credentials"
import * as accountsAccountIdRoleBindings from "@system/interface/routes/system.accounts.$accountId.role-bindings"
import * as accountsAccountIdRoleBindingsBindingId from "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId"
import * as attachments from "@system/interface/routes/system.attachments"
import * as attachmentsAttachmentId from "@system/interface/routes/system.attachments.$attachmentId"
import * as attachmentsPurgeUnlinked from "@system/interface/routes/system.attachments.purge-unlinked"
import * as auditEvents from "@system/interface/routes/system.audit-events"
import * as auditEventsEventId from "@system/interface/routes/system.audit-events.$eventId"
import * as authPasswordReset from "@system/interface/routes/system.auth.password.reset"
import * as batchJobs from "@system/interface/routes/system.batch-jobs"
import * as bootstrap from "@system/interface/routes/system.bootstrap"
import * as browserLoginCodes from "@system/interface/routes/system.browser-login-codes"
import * as browserSessions from "@system/interface/routes/system.browser-sessions"
import * as cliAuthorizationCallback from "@system/interface/routes/system.cli-authorization-callback"
import * as cliAuthorizations from "@system/interface/routes/system.cli-authorizations"
import * as cliSessions from "@system/interface/routes/system.cli-sessions"
import * as connectors from "@system/interface/routes/system.connectors"
import * as connectorsConnectorId from "@system/interface/routes/system.connectors.$connectorId"
import * as deadLetters from "@system/interface/routes/system.dead-letters"
import * as deadLettersDeadLetterIdRequeue from "@system/interface/routes/system.dead-letters.$deadLetterId.requeue"
import * as deliveries from "@system/interface/routes/system.deliveries"
import * as deliveriesDeliveryId from "@system/interface/routes/system.deliveries.$deliveryId"
import * as health from "@system/interface/routes/system.health"
import * as identitySessions from "@system/interface/routes/system.identity-sessions"
import * as inboxMessagesMessageId from "@system/interface/routes/system.inbox-messages.$messageId"
import * as integrationExchanges from "@system/interface/routes/system.integration-exchanges"
import * as integrationExchangesExchangeId from "@system/interface/routes/system.integration-exchanges.$exchangeId"
import * as integrationExchangesExchangeIdReconciliations from "@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations"
import * as machineCredentialsCredentialId from "@system/interface/routes/system.machine-credentials.$credentialId"
import * as machineSessions from "@system/interface/routes/system.machine-sessions"
import * as notifications from "@system/interface/routes/system.notifications"
import * as notificationsId from "@system/interface/routes/system.notifications.$id"
import * as notificationsUnreadCount from "@system/interface/routes/system.notifications.unread-count"
import * as oauthAuthorizations from "@system/interface/routes/system.oauth.authorizations"
import * as oauthMcpGrants from "@system/interface/routes/system.oauth.mcp-grants"
import * as oauthToken from "@system/interface/routes/system.oauth.token"
import * as oauthUserinfo from "@system/interface/routes/system.oauth.userinfo"
import * as principals from "@system/interface/routes/system.principals"
import * as principalsPrincipalId from "@system/interface/routes/system.principals.$principalId"
import * as principalsPrincipalIdMachineCredentials from "@system/interface/routes/system.principals.$principalId.machine-credentials"
import * as roles from "@system/interface/routes/system.roles"
import * as rolesRoleId from "@system/interface/routes/system.roles.$roleId"
import * as sessions from "@system/interface/routes/system.sessions"
import * as stepUpGrants from "@system/interface/routes/system.step-up-grants"

// `bun run gen:app` の生成物。手で編集せず、routeは所有contextのinterface/route-manifest.tsへ足す。
export const systemPreDatabaseRoutes = new Hono<SystemHonoEnv>().get("/health", ...health.GET)

export const systemPublicRoutes = new Hono<SystemHonoEnv>()
  .get("/accounts", ...accounts.GET)
  .post("/accounts", ...accounts.POST)
  .get("/accounts/:accountId", ...accountsAccountId.GET)
  .patch("/accounts/:accountId", ...accountsAccountId.PATCH)
  .get("/accounts/:accountId/identities", ...accountsAccountIdIdentities.GET)
  .post("/accounts/:accountId/identities", ...accountsAccountIdIdentities.POST)
  .get("/accounts/:accountId/identities/:identityId", ...accountsAccountIdIdentitiesIdentityId.GET)
  .delete(
    "/accounts/:accountId/identities/:identityId",
    ...accountsAccountIdIdentitiesIdentityId.DELETE,
  )
  .patch("/accounts/:accountId/password-credentials", ...accountsAccountIdPasswordCredentials.PATCH)
  .get("/accounts/:accountId/role-bindings", ...accountsAccountIdRoleBindings.GET)
  .post("/accounts/:accountId/role-bindings", ...accountsAccountIdRoleBindings.POST)
  .delete(
    "/accounts/:accountId/role-bindings/:bindingId",
    ...accountsAccountIdRoleBindingsBindingId.DELETE,
  )
  .post("/attachments", ...attachments.POST)
  .post("/attachments/purge-unlinked", ...attachmentsPurgeUnlinked.POST)
  .get("/attachments/:attachmentId", ...attachmentsAttachmentId.GET)
  .get("/audit-events", ...auditEvents.GET)
  .get("/audit-events/:eventId", ...auditEventsEventId.GET)
  .post("/auth/password/reset", ...authPasswordReset.POST)
  .patch("/auth/password/reset", ...authPasswordReset.PATCH)
  .get("/batch-jobs", ...batchJobs.GET)
  .post("/bootstrap", ...bootstrap.POST)
  .post("/browser-login-codes", ...browserLoginCodes.POST)
  .post("/browser-sessions", ...browserSessions.POST)
  .get("/cli-authorization-callback", ...cliAuthorizationCallback.GET)
  .get("/cli-authorizations", ...cliAuthorizations.GET)
  .post("/cli-sessions", ...cliSessions.POST)
  .get("/connectors", ...connectors.GET)
  .post("/connectors", ...connectors.POST)
  .patch("/connectors/:connectorId", ...connectorsConnectorId.PATCH)
  .get("/dead-letters", ...deadLetters.GET)
  .post("/dead-letters/:deadLetterId/requeue", ...deadLettersDeadLetterIdRequeue.POST)
  .get("/deliveries", ...deliveries.GET)
  .post("/deliveries", ...deliveries.POST)
  .patch("/deliveries/:deliveryId", ...deliveriesDeliveryId.PATCH)
  .post("/identity-sessions", ...identitySessions.POST)
  .patch("/inbox-messages/:messageId", ...inboxMessagesMessageId.PATCH)
  .get("/integration-exchanges", ...integrationExchanges.GET)
  .post("/integration-exchanges", ...integrationExchanges.POST)
  .get("/integration-exchanges/:exchangeId", ...integrationExchangesExchangeId.GET)
  .patch("/integration-exchanges/:exchangeId", ...integrationExchangesExchangeId.PATCH)
  .get(
    "/integration-exchanges/:exchangeId/reconciliations",
    ...integrationExchangesExchangeIdReconciliations.GET,
  )
  .post(
    "/integration-exchanges/:exchangeId/reconciliations",
    ...integrationExchangesExchangeIdReconciliations.POST,
  )
  .post("/machine-sessions", ...machineSessions.POST)
  .get("/notifications", ...notifications.GET)
  .post("/notifications", ...notifications.POST)
  .patch("/notifications", ...notifications.PATCH)
  .get("/notifications/unread-count", ...notificationsUnreadCount.GET)
  .get("/notifications/:id", ...notificationsId.GET)
  .patch("/notifications/:id", ...notificationsId.PATCH)
  .delete("/notifications/:id", ...notificationsId.DELETE)
  .post("/oauth/token", ...oauthToken.POST)
  .get("/oauth/userinfo", ...oauthUserinfo.GET)
  .get("/principals", ...principals.GET)
  .post("/principals", ...principals.POST)
  .get("/principals/:principalId", ...principalsPrincipalId.GET)
  .patch("/principals/:principalId", ...principalsPrincipalId.PATCH)
  .get(
    "/principals/:principalId/machine-credentials",
    ...principalsPrincipalIdMachineCredentials.GET,
  )
  .post(
    "/principals/:principalId/machine-credentials",
    ...principalsPrincipalIdMachineCredentials.POST,
  )
  .delete(
    "/principals/:principalId/machine-credentials/:credentialId",
    ...machineCredentialsCredentialId.DELETE,
  )
  .get("/roles", ...roles.GET)
  .post("/roles", ...roles.POST)
  .get("/roles/:roleId", ...rolesRoleId.GET)
  .patch("/roles/:roleId", ...rolesRoleId.PATCH)
  .delete("/roles/:roleId", ...rolesRoleId.DELETE)
  .get("/sessions", ...sessions.GET)
  .post("/sessions", ...sessions.POST)
  .patch("/sessions", ...sessions.PATCH)
  .delete("/sessions", ...sessions.DELETE)
  .post("/step-up-grants", ...stepUpGrants.POST)

export const systemAuthenticatedRoutes = new Hono<SystemHonoEnv>().post(
  "/oauth/authorizations",
  ...oauthAuthorizations.POST,
)

export const systemAuditedRoutes = new Hono<SystemHonoEnv>().post(
  "/oauth/mcp-grants",
  ...oauthMcpGrants.POST,
)
