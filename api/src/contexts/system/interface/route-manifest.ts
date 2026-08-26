/** 公開routeの宣言的な正本。API rootの生成器だけが合成する。 */
export const systemRouteManifest = [
  {
    method: "POST",
    path: "/system/attachments",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/attachments/:attachmentId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments.$attachmentId",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/health",
    phase: "pre-database",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.health",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/system/accounts",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/accounts",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/accounts/:accountId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId/identities",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/accounts/:accountId/identities",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId/identities/:identityId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities.$identityId",
      exportName: "GET",
    },
  },
  {
    method: "DELETE",
    path: "/system/accounts/:accountId/identities/:identityId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities.$identityId",
      exportName: "DELETE",
    },
  },
  {
    method: "PATCH",
    path: "/system/accounts/:accountId/password-credentials",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.password-credentials",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId/role-bindings",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.role-bindings",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/accounts/:accountId/role-bindings",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.role-bindings",
      exportName: "POST",
    },
  },
  {
    method: "DELETE",
    path: "/system/accounts/:accountId/role-bindings/:bindingId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId",
      exportName: "DELETE",
    },
  },
  {
    method: "POST",
    path: "/system/bootstrap",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.bootstrap",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/attachments/purge-unlinked",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments.purge-unlinked",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/browser-login-codes",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.browser-login-codes",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/browser-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.browser-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/cli-authorization-callback",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.cli-authorization-callback",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/cli-authorizations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.cli-authorizations",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/cli-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.cli-sessions",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/identity-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.identity-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/roles",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/roles",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles.$roleId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles.$roleId",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles.$roleId",
      exportName: "DELETE",
    },
  },

  {
    method: "GET",
    path: "/system/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/notifications/unread-count",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.unread-count",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.$id",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.$id",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.$id",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/system/audit-events",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.audit-events",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/audit-events/:eventId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.audit-events.$eventId",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/auth/password/reset",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.auth.password.reset",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/auth/password/reset",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.auth.password.reset",
      exportName: "PATCH",
    },
  },
  {
    method: "POST",
    path: "/system/oauth/token",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.token",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/oauth/userinfo",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.userinfo",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/oauth/authorizations",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.authorizations",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/oauth/mcp-grants",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.mcp-grants",
      exportName: "POST",
    },
  },
] as const
