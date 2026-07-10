import Link from "next/link"
import { Fragment } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"

/**
 * 全ページ共通の見出しブロック。パンくず・タイトル・説明・右側アクションを縦並びに整える。
 * h1 とアクション領域の縦リズム・余白を統一するために collocation でなく共有コンポーネントにする。
 */
type Breadcrumb = {
  label: string
  href?: string
}

type Props = {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: ReadonlyArray<Breadcrumb>
}

export function PageHeader(props: Props) {
  const breadcrumbs = props.breadcrumbs ?? []

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      {breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1

              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {isLast || crumb.href === undefined ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={crumb.href} />}>
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>

                  {isLast ? null : <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-start gap-2">
          <SidebarTrigger className="mt-1" />

          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>

            {props.description !== undefined ? (
              <p className="text-sm text-muted-foreground">{props.description}</p>
            ) : null}
          </div>
        </div>

        {props.actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2">{props.actions}</div>
        ) : null}
      </div>
    </div>
  )
}
