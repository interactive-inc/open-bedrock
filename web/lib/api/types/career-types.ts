// api/src/career の *-schema.ts と同形の手書き type。
// api と疎結合にするため api 側から import しない。

export type CareerSheet = {
  employee_id: number
  goals_text: string | null
  strengths_text: string | null
  updated_at: string | null
}

export type CareerSheetUpdateRequest = {
  goals_text: string | null
  strengths_text: string | null
}

export type CareerPosting = {
  id: number
  title: string
  dept_id: number | null
  dept_name: string | null
  required_skills: string | null
  status: "open" | "closed"
}

export type CareerApplication = {
  id: number
  posting_id: number
  applicant_id: number
  message: string | null
  status: "applied" | "accepted" | "rejected"
}

export type CareerApplyRequest = {
  message: string | null
}

export type CareerApplicationUpdateRequest = {
  message: string | null
}
