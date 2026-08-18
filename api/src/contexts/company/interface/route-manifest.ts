/** canonical Company APIの宣言的な正本。API rootだけがHTTP runtimeへ合成する。 */
export const companyRouteManifest = [
  {
    method: "GET",
    path: "/company/v1/capabilities",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/capabilities/route",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/v1/profile",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/profile",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/profile",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/people",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/people",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/people",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/people",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/employees",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employees",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/employees",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employees",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/employments",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employments",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/employments",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employments",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/organization-snapshots",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/organization-snapshots",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/organization-changes",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/organization-changes",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/definitions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/definitions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/definitions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/account-employee-links",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/account-employee-links",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/account-employee-links",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/account-employee-links",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/personnel-actions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/personnel-actions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/personnel-actions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/personnel-actions",
      exportName: "POST",
    },
  },
] as const
