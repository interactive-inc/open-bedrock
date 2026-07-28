/** api/src/skill/skill-schema.ts と同形の手書き type（API と疎結合に保つ）。 */
export type Skill = {
  code: string
  name: string
  category: string
}

/** api/src/skill/employee-skill-response-schema.ts と同形の手書き type。 */
export type EmployeeSkillResponse = {
  skill_code: string
  skill_name: string
  skill_category: string
  level: number
  years: number | null
  note: string | null
}

/** PUT /employee-skills/me のリクエストボディ。api/src/skill/set-skill-request-schema.ts と同形。 */
export type SetSkillRequest = {
  skill_code: string
  level: number
  years: number | null
  note: string | null
}

/** GET /skill-definitions のクエリ。未指定は null で表す。 */
export type SkillSearchQuery = {
  q: string | null
  category: string | null
}
