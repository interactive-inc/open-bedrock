import { EmployeeCertificationsTable } from "@/app/(app)/certification/certifications/_components/employee-certifications-table"
import { FetchError } from "@/components/fetch-error"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { listEmployeeCertifications } from "@/lib/api/list-employee-certifications"

type Props = {
  canViewAll: boolean
  employeeId: string
}

/** 指定された従業員の資格保有記録。閲覧可能な範囲は API で検査する。 */
export async function EmployeeCertificationsSection(props: Props) {
  const records =
    props.employeeId.trim() === ""
      ? []
      : await listEmployeeCertifications({ employeeId: props.employeeId })

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">従業員の保有資格</h2>
      <form method="get" className="flex items-end gap-4">
        <Field>
          <FieldLabel htmlFor="certification-employee">従業員 ID</FieldLabel>
          <Input
            id="certification-employee"
            name="employee_id"
            defaultValue={props.employeeId}
            required
          />
        </Field>
        <Button type="submit">検索</Button>
      </form>

      {props.canViewAll ? (
        <p className="text-sm text-muted-foreground">
          従業員 ID を指定して保有記録を確認できます。
        </p>
      ) : null}

      {records instanceof Error ? (
        <FetchError message="資格保有記録の取得に失敗しました" />
      ) : props.employeeId.trim() !== "" ? (
        <EmployeeCertificationsTable rows={records} />
      ) : (
        <p className="text-sm text-muted-foreground">従業員 ID を入力して検索してください。</p>
      )}
    </section>
  )
}
