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
    path: "/company/employee-directory",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-directory",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employee-directory/:code",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-directory.$code",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/employee-directory/:code",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-directory.$code",
      exportName: "PUT",
    },
  },
  {
    method: "GET",
    path: "/company/employee-lifecycle/:code/state",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employee-lifecycle/:code/events",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/my-profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-profile",
      exportName: "PUT",
    },
  },
  {
    method: "GET",
    path: "/company/my-direct-reports",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-direct-reports",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/my-organization-units",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-organization-units",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employee-events",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-events",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employee-events",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-events",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/employee-grades",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-grades",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employee-grades",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-grades",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/grade-definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.grade-definitions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/grade-definitions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.grade-definitions",
      exportName: "POST",
    },
  },
  {
    method: "PUT",
    path: "/company/grade-definitions/:id",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.grade-definitions.$id",
      exportName: "PUT",
    },
  },
  {
    method: "DELETE",
    path: "/company/grade-definitions/:id",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.grade-definitions.$id",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/company/position-definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.position-definitions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/position-definitions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.position-definitions",
      exportName: "POST",
    },
  },
  {
    method: "PUT",
    path: "/company/position-definitions/:id",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.position-definitions.$id",
      exportName: "PUT",
    },
  },
  {
    method: "DELETE",
    path: "/company/position-definitions/:id",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.position-definitions.$id",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/company/organization-units",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/organization-units",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/organization-units/:code",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/organization-units/:code",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code",
      exportName: "PUT",
    },
  },
  {
    method: "DELETE",
    path: "/company/organization-units/:code",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/company/organization-units/:code/members",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code.members",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/organization-tree",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-tree",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/reporting-lines/:employeeCode",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode",
      exportName: "GET",
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
  {
    method: "POST",
    path: "/company/personnel-action-executions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-action-executions",
      exportName: "POST",
    },
  },
] as const
