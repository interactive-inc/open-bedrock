export type CompanyHttpInputError = Readonly<{
  status: 400 | 401 | 422 | 503
  code: string
  detail: string
}>
