// api/src/survey/*-schema.ts と同形の手書き type。
// api と疎結合にするため api/src からは import しない。

// 質問の種類。scale=スケール, choice=選択肢, text=自由記述。
export type SurveyQuestionType = "scale" | "choice" | "text"

// アンケート 1 問の定義。GET /surveys の questions_json に入る要素。
export type SurveyQuestion = {
  id: string
  type: SurveyQuestionType
  text: string
}

// GET /surveys の一覧要素。
// questions_json は unknown 配列で返るため、画面側で SurveyQuestion に絞り込む。
export type SurveyListItem = {
  id: number
  title: string
  status: "open" | "closed"
  questions_json: ReadonlyArray<unknown>
}

// POST /surveys/:id/responses のリクエストボディ。
// answers_json は 質問 id をキーにした回答値のマップ。
export type SubmitSurveyResponseRequest = {
  answers_json: Record<string, unknown>
}

// POST /surveys/:id/responses の成功レスポンス。
export type SurveySubmission = {
  id: number
  survey_id: number
  respondent_id: number
  answers_json: unknown
  submitted_at: string
}

// GET /surveys/responses/me と PUT /surveys/responses/:id のレスポンス要素。
// api は snake_case で返す。id は永続化前 null になりうる SurveyResponse をそのまま整形するため number | null。
export type SurveyResponseItem = {
  id: number | null
  survey_id: number
  respondent_id: number
  answers_json: unknown
  submitted_at: string
}

// PUT /surveys/responses/:id のリクエストボディ。
// answers_json は 質問 id をキーにした回答値のマップ。
export type UpdateSurveyResponseRequest = {
  answers_json: Record<string, unknown>
}

// GET /surveys/:id/summary の質問ごとの集計。
// distribution は scale/choice の選択肢別件数、answers は text の自由記述一覧。
export type SurveyQuestionSummary = {
  id: string
  title: string
  type: SurveyQuestionType
  distribution: Record<string, number>
  answers: ReadonlyArray<string>
}

// GET /surveys/:id/summary のレスポンス全体。
export type SurveySummary = {
  survey_id: number
  title: string
  response_count: number
  questions: ReadonlyArray<SurveyQuestionSummary>
}

// POST /surveys のリクエストボディ（管理者ロールのみ）。
// questions_json は設問定義の配列。api 側で内容を検証する。
export type CreateSurveyRequest = {
  title: string
  status: "open" | "closed"
  questions_json: ReadonlyArray<unknown>
}

// PUT /surveys/:survey_id のリクエストボディ（管理者ロールのみ）。
export type UpdateSurveyRequest = {
  title: string
  status: "open" | "closed"
  questions_json: ReadonlyArray<unknown>
}
