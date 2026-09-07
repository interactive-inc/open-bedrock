/** GET /certification-definitions の要素。api は snake_case で返す。 */
export type CertificationResponse = {
  id: string
  code: string
  name: string
  issuer: string | null
  description: string | null
  created_at: string
}

/** GET /employee-certifications の要素。 */
export type EmployeeCertificationResponse = {
  id: string
  employee_id: string
  certification_id: string
  acquired_on: string
  expires_on: string | null
  note: string | null
  created_at: string
}
