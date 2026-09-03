import { EmployeeCertificationsTable } from "@/app/(app)/certification/certifications/_components/employee-certifications-table"
import { FetchError } from "@/components/fetch-error"
import { listEmployeeCertifications } from "@/lib/api/list-employee-certifications"

type Props = {
  canViewAll: boolean
}

/** 自分の資格保有記録セクション。employee_id を渡さず本人分を取得する。 */
export async function EmployeeCertificationsSection(props: Props) {
  const records = await listEmployeeCertifications({})

  if (records instanceof Error) {
    return <FetchError message="資格保有記録の取得に失敗しました" />
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">自分の保有資格</h2>

      {props.canViewAll ? (
        <p className="text-sm text-muted-foreground">
          全社の保有記録は karte certifications records --employee-id で確認できます。
        </p>
      ) : null}

      <EmployeeCertificationsTable rows={records} />
    </section>
  )
}
