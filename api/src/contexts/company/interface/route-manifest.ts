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
      module: "@/contexts/company/interface/routes/company/v1/profile/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/profile/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/people",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/people/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/people",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/people/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/employees",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employees/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/employees",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employees/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/employments",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employments/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/employments",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/employments/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/organization-snapshots",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/organization-snapshots/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/organization-changes",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/organization-changes/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/definitions/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/definitions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/definitions/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/account-employee-links",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/account-employee-links/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/account-employee-links",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/account-employee-links/route",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/v1/personnel-actions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/personnel-actions/route",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/v1/personnel-actions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company/v1/personnel-actions/route",
      exportName: "POST",
    },
  },
] as const
