/** 台帳の公開routeを宣言する。 */
export const softwareLicenseRouteManifest = [
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
] as const
