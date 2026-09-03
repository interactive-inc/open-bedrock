import { CompanyResourceTable } from "@/components/company-resource-table"
import { FetchError } from "@/components/fetch-error"
import { getCompanyPersonnelActionResources } from "@/lib/api/get-company-personnel-action-resources"
import { filterResourcesByType } from "@/lib/company/filter-resources-by-type"
import { readResourceText } from "@/lib/company/read-resource-text"

/** 人事発令を読み取り専用で並べる。 */
export async function CompanyPersonnelActionSection() {
  const personnelActions = await getCompanyPersonnelActionResources()

  if (personnelActions instanceof Error) {
    return <FetchError message="人事発令の取得に失敗しました" />
  }

  const actions = filterResourcesByType(personnelActions.resources, "personnel-action")

  return (
    <CompanyResourceTable
      caption="人事発令の一覧"
      resources={actions}
      emptyTitle="人事発令が登録されていません"
      emptyDescription="発令の正本は API と CLI が持ちます。まだ登録がありません。"
      columns={[
        {
          header: "発令種別",
          toValue: (resource) => readResourceText(resource, "actionType") ?? "-",
        },
        { header: "識別子", toValue: (resource) => resource.id },
      ]}
    />
  )
}
