export type CompanyResourceRow = Readonly<{
  organization_id: string
  resource_type: string
  resource_id: string
  revision: number
  state: string
  effective_from: string
  effective_to: string | null
  attributes_json: string
}>

export type CompanyCommandReceiptRow = Readonly<{
  fingerprint: string
  organization_revision: number
}>
