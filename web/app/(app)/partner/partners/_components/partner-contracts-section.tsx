import { ContractCreateForm } from "@/app/(app)/partner/partners/_components/contract-create-form"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getContractList } from "@/lib/api/get-contract-list"

type Props = {
  partnerId: number
  partnerCode: string
  canManageContracts: boolean
}

/**
 * 取引先詳細の契約記録セクション。閲覧権限（contract:read:all）がない場合 api は 403 を返すため、
 * 取得が Error のときはセクション自体を描画しない（空表示ではなく非表示）。
 */
export async function PartnerContractsSection(props: Props) {
  const contracts = await getContractList({ partnerId: props.partnerId, order: "renewal_near" })

  if (contracts instanceof Error) {
    return null
  }

  return (
    <Card className="gap-0">
      <div className="flex flex-col gap-4 p-8">
        <h2 className="text-lg font-semibold">契約記録</h2>

        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">契約記録はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="契約記録一覧">
              <TableHeader>
                <TableRow>
                  <TableHead>契約名</TableHead>
                  <TableHead>契約日</TableHead>
                  <TableHead>期間</TableHead>
                  <TableHead>更新期限</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.title}</TableCell>

                    <TableCell>{contract.contract_date}</TableCell>

                    <TableCell>
                      {contract.starts_on ?? "-"} 〜 {contract.ends_on ?? "-"}
                    </TableCell>

                    <TableCell>{contract.renewal_deadline ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {props.canManageContracts ? (
          <ContractCreateForm partnerId={props.partnerId} partnerCode={props.partnerCode} />
        ) : null}
      </div>
    </Card>
  )
}
