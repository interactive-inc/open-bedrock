export type CareerSheet = {
  employee_id: string
  goals_text: string | null
  strengths_text: string | null
  updated_at: string | null
}

export type CareerSheetUpdateRequest = {
  goals_text: string | null
  strengths_text: string | null
}

export type CareerPosting = {
  // 作成系ハンドラは insert 直後の autoincrement id（number | null）を返す。
  id: number | null
  title: string
  dept_id: number | null
  dept_name: string | null
  required_skills: string | null
  status: "open" | "closed"
}

export type CareerPostingCreateRequest = {
  title: string
  dept_id: number | null
  dept_name: string | null
  required_skills: string | null
  status: "open" | "closed"
}

export type CareerPostingUpdateRequest = {
  title: string
  dept_id: number | null
  dept_name: string | null
  required_skills: string | null
  status: "open" | "closed"
}

export type CareerApplication = {
  // api は永続化前を null とするため number | null。
  id: number | null
  posting_id: number
  applicant_id: string
  message: string | null
  status: "applied" | "accepted" | "rejected"
}

export type CareerApplyRequest = {
  message: string | null
}

export type CareerApplicationUpdateRequest = {
  message: string | null
}
