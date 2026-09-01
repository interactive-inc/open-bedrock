/** ItIncident が所有する権限key。 */
export const IT_INCIDENT_PERMISSION_KEYS = [
  "it_incident:manage",
  "it_incident:read:all",
] as const

export type ItIncidentPermissionKey = (typeof IT_INCIDENT_PERMISSION_KEYS)[number]
