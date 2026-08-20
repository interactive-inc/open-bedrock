/** 公開routeの宣言的な正本。API rootの生成器だけが合成する。 */
export const systemRouteManifest = [
  {
    method: "GET",
    path: "/health",
    phase: "pre-database",
    handler: { kind: "module", module: "@system/interface/routes/health", exportName: "GET" },
  },
  {
    method: "GET",
    path: "/system/v1/health",
    phase: "pre-database",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.health",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/v1/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.sessions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.sessions",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/v1/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.sessions",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/v1/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.sessions",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/system/v1/accounts",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/accounts",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/v1/accounts/:accountId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/v1/accounts/:accountId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/v1/accounts/:accountId/identities",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.identities",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/accounts/:accountId/identities",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.identities",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/v1/accounts/:accountId/identities/:identityId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.identities.$identityId",
      exportName: "GET",
    },
  },
  {
    method: "DELETE",
    path: "/system/v1/accounts/:accountId/identities/:identityId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.identities.$identityId",
      exportName: "DELETE",
    },
  },
  {
    method: "PATCH",
    path: "/system/v1/accounts/:accountId/password-credentials",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.password-credentials",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/v1/accounts/:accountId/role-bindings",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.role-bindings",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/accounts/:accountId/role-bindings",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.role-bindings",
      exportName: "POST",
    },
  },
  {
    method: "DELETE",
    path: "/system/v1/accounts/:accountId/role-bindings/:bindingId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.accounts.$accountId.role-bindings.$bindingId",
      exportName: "DELETE",
    },
  },
  {
    method: "POST",
    path: "/system/v1/bootstrap",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.bootstrap",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/v1/browser-login-codes",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.browser-login-codes",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/v1/browser-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.browser-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/v1/cli-authorization-callback",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.cli-authorization-callback",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/v1/cli-authorizations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.cli-authorizations",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/cli-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.cli-sessions",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/v1/identity-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.identity-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/v1/roles",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.roles",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/roles",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.roles",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/v1/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.roles.$roleId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/v1/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.roles.$roleId",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/v1/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.roles.$roleId",
      exportName: "DELETE",
    },
  },

  {
    method: "GET",
    path: "/system/v1/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/v1/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/v1/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/v1/notifications/unread-count",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications.unread-count",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/v1/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications.$id",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/v1/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications.$id",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/v1/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.notifications.$id",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/system/v1/audit-events",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.audit-events",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/v1/audit-events/:eventId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.v1.audit-events.$eventId",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/auth/password/reset",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/auth.password.reset",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/auth/password/reset",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/auth.password.reset",
      exportName: "PATCH",
    },
  },
  {
    method: "POST",
    path: "/oauth/token",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/oauth.token",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/oauth/userinfo",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/oauth.userinfo",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/oauth/authorizations",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@system/interface/routes/oauth.authorizations",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/oauth/mcp-grants",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@system/interface/routes/oauth.mcp-grants",
      exportName: "POST",
    },
  },
] as const
