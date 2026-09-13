/** 台帳の公開routeを宣言する。 */
export const softwareLicenseRouteManifest = [
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/preservation-requests",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/software-license/software-licenses",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/software-license/interface/routes/software-license.software-licenses",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/software-license/interface/routes/software-license.software-licenses",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/software-license/software-licenses/:id",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/software-license/interface/routes/software-license.software-licenses.$id",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/software-license/software-licenses/:id",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/software-license/interface/routes/software-license.software-licenses.$id",
      exportName: "PUT",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/cancel",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.cancel",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/software-license/software-licenses/:id/history",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.history",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/assignments",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.assignments",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/software-license/software-licenses/assignments",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.assignments",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/assignments/:assignmentId/release",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.assignments.$assignmentId.release",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/preservation-requests/:number/execute",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests.$number.execute",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/preservation-requests/:number/approve",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests.$number.approve",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/software-license/software-licenses/:id/preservation-requests/:number",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests.$number",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/preservation-requests/:number/reject",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests.$number.reject",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/preservation-requests/:number/withdraw",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests.$number.withdraw",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/software-license/software-licenses/:id/preservation-requests/:number/resubmit",
    phase: "audited",
    handler: {
      kind: "module",
      module:
        "@/contexts/software-license/interface/routes/software-license.software-licenses.$id.preservation-requests.$number.resubmit",
      exportName: "POST",
    },
  },
] as const
