/** canonical Company APIの宣言的な正本。API rootだけがHTTP runtimeへ合成する。 */
export const companyRouteManifest = [
  {
    method: "GET",
    path: "/company/organization-profile",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-profile",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/organization-profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-profile",
      exportName: "PUT",
    },
  },
  {
    method: "POST",
    path: "/company/bootstrap",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.bootstrap",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/capabilities",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.capabilities",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/profile",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.profile",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.profile",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/people",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.people",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/people",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.people",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/employees",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employees",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employees",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employees",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/employments",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employments",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employments",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employments",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/organization-snapshots",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-snapshots",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/organization-changes",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-changes",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.definitions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/definitions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.definitions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/account-employee-links",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.account-employee-links",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/account-employee-links",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.account-employee-links",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/personnel-actions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-actions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/personnel-actions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-actions",
      exportName: "POST",
    },
  },
] as const
