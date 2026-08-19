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
