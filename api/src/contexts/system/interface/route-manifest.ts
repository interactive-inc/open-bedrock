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
] as const
