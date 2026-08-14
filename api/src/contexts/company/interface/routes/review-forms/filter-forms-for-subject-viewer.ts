import type { ReviewForm } from "@/contexts/company/domain/review/review-form.entity"

export type Props = {
  forms: ReadonlyArray<ReviewForm>
  isAdministrator: boolean
  isSubjectSelf: boolean
}

/**
 * 被評価者向けのフォーム一覧を、閲覧者の立場に応じて絞り込む純粋関数。
 * 管理者は全件、被評価者本人は disclosed のフォームのみを読める。
 * それ以外の閲覧者には空を返す（呼び出し側で 403 を判断済みの前提）。
 */
export function filterFormsForSubjectViewer(props: Props): ReadonlyArray<ReviewForm> {
  if (props.isAdministrator) {
    return props.forms
  }

  if (props.isSubjectSelf) {
    return props.forms.filter((form) => form.visibility === "disclosed")
  }

  return []
}
