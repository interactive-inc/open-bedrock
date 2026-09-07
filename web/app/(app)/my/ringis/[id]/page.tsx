import Link from "next/link"
import { getRingi } from "@/lib/api/get-ringi"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { RingiStatusBadge } from "@/components/ringi-status-badge"
import { RingiCreateForm } from "@/app/(app)/my/ringis/_components/ringi-create-form"
import { RingiDecisionForm } from "@/app/(app)/my/ringis/_components/ringi-decision-form"
import { RingiProcedureActionForm } from "@/app/(app)/my/ringis/_components/ringi-procedure-action-form"

type Props = { params: Promise<{ id: string }> }
export const metadata = { title: "稟議の内容と判断" }

/** 内容・判断履歴を確認し、取消・再提出・確定待ちの処理を行う。 */
export default async function RingiDetailPage(props: Props) {
  const params = await props.params
  const ringi = await getRingi(Number(params.id))
  if (ringi instanceof Error) return <FetchError message={ringi.message} />
  const requestKey = crypto.randomUUID()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={ringi.title}>
        <Link href="/my/ringis">自分の稟議へ</Link>
      </PageHeader>
      <div>
        <RingiStatusBadge status={ringi.status} />
      </div>
      <dl className="grid gap-2">
        <dt>申請者</dt>
        <dd>{ringi.applicant_name}</dd>
        <dt>起案時の提出先</dt>
        <dd>{ringi.approver_name}</dd>
        <dt>金額</dt>
        <dd>{ringi.amount.toLocaleString("ja-JP")} 円</dd>
        <dt>理由</dt>
        <dd className="whitespace-pre-wrap">{ringi.reason}</dd>
      </dl>
      {ringi.previous_ringi_id !== null ? (
        <Link href={`/my/ringis/${ringi.previous_ringi_id}`}>差戻し前の稟議を見る</Link>
      ) : null}
      {ringi.next_ringi_id !== null ? (
        <Link href={`/my/ringis/${ringi.next_ringi_id}`}>再提出された稟議を見る</Link>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">判断の記録</h2>
        <p>
          {ringi.approvals} / {ringi.required_approvals ?? "—"} 名の承認
        </p>
        {ringi.decisions.length === 0 ? (
          <p>判断はまだ記録されていません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ringi.decisions.map((decision, index) => (
              <li key={`${decision.task_key}:${decision.task_round}:${index}`}>
                {decision.action === "approve"
                  ? "承認"
                  : decision.action === "return"
                    ? "差戻し"
                    : "否認"}{" "}
                — {decision.comment ?? "コメントなし"}
              </li>
            ))}
          </ul>
        )}
      </section>
      {ringi.can_decide && ringi.decision_target !== null ? (
        <RingiDecisionForm
          key={JSON.stringify(ringi.decision_target)}
          ringiId={ringi.id}
          decisionTarget={ringi.decision_target}
        />
      ) : null}
      {ringi.can_execute && ringi.decision_target !== null ? (
        <RingiProcedureActionForm
          ringiId={ringi.id}
          decisionTarget={ringi.decision_target}
          operation="execute"
        />
      ) : null}
      {ringi.can_cancel && ringi.decision_target !== null ? (
        <RingiProcedureActionForm
          ringiId={ringi.id}
          decisionTarget={ringi.decision_target}
          operation="cancel"
        />
      ) : null}
      {ringi.can_submit_legacy ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">承認規程へ提出</h2>
          <p>元の番号・内容・起案日を保ち、現在の会社規程へ提出します。</p>
          <RingiCreateForm requestKey={requestKey} initial={ringi} mode="adopt" />
        </section>
      ) : null}
      {ringi.can_resubmit ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">修正して再提出</h2>
          <p>この稟議は履歴として残り、修正した内容には新しい稟議番号が付きます。</p>
          <RingiCreateForm requestKey={requestKey} initial={ringi} mode="resubmit" />
        </section>
      ) : null}
    </div>
  )
}
