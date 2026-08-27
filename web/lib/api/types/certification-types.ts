/** GET /certification-definitions の要素。api は snake_case で返す。 */
export type CertificationResponse = {
  id: number
  code: string
  name: string
  issuer: string | null
  description: string | null
  created_at: string
}

/** GET /employee-certifications の要素。 */
export type EmployeeCertificationResponse = {
  id: number
  employee_id: string
  certification_id: number
  acquired_on: string
  expires_on: string | null
  note: string | null
  created_at: string
}
