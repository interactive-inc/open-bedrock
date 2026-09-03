import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vite-plus/test"
import { featureRegistry } from "@/lib/feature/feature-registry"

/**
 * サイドバーの label が画面タイトルの正本（CLAUDE.md 参照）。
 * href からディレクトリを引き、その page.tsx（部署ハブなど、見出しを共有レイアウトが
 * 持つ画面は layout.tsx も）を実際に読んで PageHeader の title と metadata.title を
 * 抜き出し、label と一致するかを検査する。動的な title（変数・テンプレートリテラル・
 * generateMetadata）は一致とみなさず、そのまま不一致として検出する。
 */

const appRoot = path.join(import.meta.dirname, "..", "..", "app", "(app)")

function hrefToDir(href: string): string {
  const segments = href
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => (segment.startsWith(":") ? `[${segment.slice(1)}]` : segment))

  return path.join(appRoot, ...segments)
}

/** `<PageHeader title="...">` のような文字列リテラルだけを一致とみなす。 */
function findPageHeaderTitle(source: string): string | null {
  const match = source.match(/<PageHeader\s+title="([^"]*)"/)

  return match === null ? null : match[1]
}

/** `export const metadata = { title: "..." }` の文字列リテラルだけを一致とみなす。 */
function findMetadataTitle(source: string): string | null {
  const match = source.match(/export const metadata\s*=\s*\{\s*title:\s*"([^"]*)"\s*\}/)

  return match === null ? null : match[1]
}

/**
 * page.tsx に PageHeader が無ければ、見出しを共有する親 layout.tsx を辿る
 * （例: /teams/:team/attendances の見出しは /teams/[team]/layout.tsx ではなく
 * 自身の page.tsx が持つ。逆に本人領域の /my/layout.tsx のような薄いラッパは
 * 見出しを持たないので、そこで見つからなければ「無い」ままにする）。
 */
function resolvePageHeaderTitle(pageDir: string): string | null {
  const pageFile = path.join(pageDir, "page.tsx")
  const pageSource = readFileSync(pageFile, "utf8")

  const ownTitle = findPageHeaderTitle(pageSource)
  if (ownTitle !== null) return ownTitle
  if (/<PageHeader\b/.test(pageSource)) return null // title が動的など、リテラルで取れない

  const layoutFile = path.join(pageDir, "layout.tsx")
  if (existsSync(layoutFile)) {
    const layoutSource = readFileSync(layoutFile, "utf8")
    const layoutTitle = findPageHeaderTitle(layoutSource)
    if (layoutTitle !== null) return layoutTitle
  }

  return null
}

type Row = {
  slug: string
  label: string
  href: string
  pageHeaderTitle: string | null
  metadataTitle: string | null
}

const rows: ReadonlyArray<Row> = featureRegistry.flatMap((feature) =>
  feature.routes.map((route) => {
    const pageDir = hrefToDir(route.href)
    const pageFile = path.join(pageDir, "page.tsx")

    if (existsSync(pageFile) === false) {
      return {
        slug: feature.slug,
        label: route.label,
        href: route.href,
        pageHeaderTitle: null,
        metadataTitle: null,
      }
    }

    const pageSource = readFileSync(pageFile, "utf8")

    return {
      slug: feature.slug,
      label: route.label,
      href: route.href,
      pageHeaderTitle: resolvePageHeaderTitle(pageDir),
      metadataTitle: findMetadataTitle(pageSource),
    }
  }),
)

describe("サイドバーの label と画面タイトルの一致", () => {
  test("すべての route に対応する page.tsx が実在する", () => {
    const missing = featureRegistry
      .flatMap((feature) => feature.routes.map((route) => route.href))
      .filter((href) => existsSync(path.join(hrefToDir(href), "page.tsx")) === false)

    expect(missing).toEqual([])
  })

  test("PageHeader の title が label と一致する", () => {
    const mismatched = rows
      .filter((row) => row.pageHeaderTitle !== row.label)
      .map((row) => `${row.label} | ${row.href} | title=${JSON.stringify(row.pageHeaderTitle)}`)

    expect(mismatched).toEqual([])
  })

  test("metadata.title が label と一致する", () => {
    const mismatched = rows
      .filter((row) => row.metadataTitle !== row.label)
      .map((row) => `${row.label} | ${row.href} | meta=${JSON.stringify(row.metadataTitle)}`)

    expect(mismatched).toEqual([])
  })
})
