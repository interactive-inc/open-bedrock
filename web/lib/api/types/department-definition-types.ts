/** GET /department-definitions のレスポンス要素。api は snake_case で返す。 */
export type DepartmentDefinitionResponse = {
  id: number
  name: string
}

/** POST /department-definitions のリクエストボディ。 */
export type DepartmentDefinitionCreateRequest = {
  name: string
}
