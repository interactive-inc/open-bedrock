import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { contextResourceCatalog } from "@/lib/feature/context-resource-catalog"
import { getAdminNavigationItems } from "@/lib/feature/get-admin-navigation-items"

type Props = {
  owner: "system" | "company"
  permissions: ReadonlyArray<string>
  disabledFeatures: ReadonlyArray<string>
}

/** リソース一覧とサイドメニューの表示名・遷移先を同じ定義から表示する。 */
export function ContextResourceList(props: Props) {
  const navigation = getAdminNavigationItems(props.permissions, props.disabledFeatures)
  const resources = contextResourceCatalog.filter(
    (resource) =>
      resource.owner === props.owner && navigation.some((item) => item.href === resource.view),
  )
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>リソース</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => {
          const href = resource.view ?? `/${resource.owner}/${resource.resource}`
          const menu = navigation.find((item) => item.href === href)
          return (
            <TableRow key={resource.resource}>
              <TableCell>
                {menu ? (
                  <Link href={menu.href} prefetch={menu.prefetch ?? undefined}>
                    {menu.label}
                  </Link>
                ) : null}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
