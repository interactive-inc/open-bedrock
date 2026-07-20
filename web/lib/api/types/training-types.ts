/**
 * status は API 上 DB の text 列をそのまま返すため string。
 * 作成系ハンドラが返す絞り込み union も string に代入可能。
 */
export type TrainingCourseStatus = string

export type TrainingEnrollmentStatus = string

/**
 * GET /training/courses の各要素、GET /training/courses/:code のレスポンス、
 * POST /training/courses のレスポンスも同形（研修コース）。
 * id はエンティティ整形ルート（作成/更新）では採番前の null を含む。
 * status は一覧ルートが DB の row 値（string）をそのまま返すため広く受ける。
 */
export type TrainingCourseResponse = {
  // 作成系は insert 直後の autoincrement id（number | null）を返す。
  id: number | null
  code: string
  title: string
  description: string | null
  duration_minutes: number | null
  category: string
  is_required: boolean
  status: string
}

/**
 * GET /training/enrollments/me, GET /training/enrollments の各要素、
 * POST /training/enrollments, POST /training/enrollments/:id/complete のレスポンスも同形（受講）。
 * id はエンティティ整形ルート（作成/完了/期限変更）では採番前の null を含む。
 * status は一覧ルートが DB の row 値（string）をそのまま返すため広く受ける。
 */
export type TrainingEnrollmentResponse = {
  // 作成系は insert 直後の autoincrement id（number | null）を返す。
  id: number | null
  course_id: number
  employee_id: number
  status: string
  completed_at: string | null
  score: number | null
  due_date: string | null
}

/** POST /training/courses のリクエスト body（特権ロールが研修コースを作成する）。 */
export type TrainingCourseCreateRequest = {
  code: string
  title: string
  category: string
  description: string | null
  duration_minutes: number | null
  is_required: boolean
}

/** POST /training/enrollments のリクエスト body（本人がコースの受講を申し込む）。 */
export type TrainingEnrollmentCreateRequest = {
  course_code: string
}

/**
 * PUT /training/courses/:code のリクエスト body（管理権限が研修コースの内容を変更する）。
 * code と status は変更されない。
 */
export type TrainingCourseUpdateRequest = {
  title: string
  category: string
  description: string | null
  duration_minutes: number | null
  is_required: boolean
}

/** PUT /training/enrollments/:id のリクエスト body（受講期限を変更する）。 */
export type TrainingEnrollmentRescheduleRequest = {
  due_date: string | null
}
