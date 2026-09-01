/** CertificateRequest が所有する権限key。 */
export const CERTIFICATE_REQUEST_PERMISSION_KEYS = [
  "certificate_request:manage",
  "certificate_request:read:all",
] as const

export type CertificateRequestPermissionKey = (typeof CERTIFICATE_REQUEST_PERMISSION_KEYS)[number]
