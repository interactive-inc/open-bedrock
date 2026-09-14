import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyAccountEmployeeLinkResources } from "@/lib/api/get-company-account-employee-link-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

/** Account と Employee の対応を読み取り専用で並べる。 */
export async function CompanyAccountEmployeeLinkSection() {
  const links = await getCompanyAccountEmployeeLinkResources()

  if (links instanceof Error) {
    return <FetchError message="アカウントと従業員の紐付けの取得に失敗しました" />
  }

  const accountEmployeeLinks = filterResourcesByType(links.resources, "account-employee-link")

  return (
    <CompanyResourceTable
      caption="アカウントと従業員の紐付け一覧"
      resources={accountEmployeeLinks}
      emptyTitle="アカウントと従業員の紐付けが登録されていません"
      emptyDescription="まだ登録がありません。"
      columns={[
        {
          header: "アカウント ID",
          toValue: (resource) => readResourceText(resource, "accountId") ?? "-",
        },
        {
          header: "従業員 ID",
          toValue: (resource) => readResourceText(resource, "employeeId") ?? "-",
        },
      ]}
    />
  )
}
