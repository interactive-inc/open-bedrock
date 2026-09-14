import { describe, expect, test } from "vite-plus/test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import composition from "@/lib/feature/composition-api-catalog.json"
import { contextResourceCatalog } from "@/lib/feature/context-resource-catalog"
import { featureRegistry } from "@/lib/feature/feature-registry"
import { getAdminNavigationItems } from "@/lib/feature/get-admin-navigation-items"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"

const permissions = [
  "system:admin",
  ...featureRegistry.flatMap((feature) =>
    feature.routes.flatMap((route) => {
      if (route.visibility.kind === "everyone") return []
      if (route.visibility.kind === "permission") return [route.visibility.permission]
      return route.visibility.permissions
    }),
  ),
]

describe("コンテキストのリソースと管理メニュー", () => {
  test("横断画面を単一コンテキスト配下に配置しない", () => {
    const menu = getAdminNavigationItems(permissions, [])
    expect(
      menu.filter(
        (item) =>
          toFeatureSpace(item.href) === "composition" &&
          /^\/(system|company|attendance)\//.test(item.href),
      ),
    ).toEqual([])
  })
  test("横断API一覧が合成ルートの宣言と一致する", () => {
    expect(composition).toEqual(
      JSON.parse(
        readFileSync(
          resolve(import.meta.dirname, "../../../api/api-route-composition.manifest.json"),
          "utf8",
        ),
      ),
    )
  })
  test("管理対象は所有コンテキストのドメインモデルに対応する", () => {
    const domainRoot = resolve(import.meta.dirname, "../../../api/src/contexts")
    const companyTypes = readFileSync(
      `${domainRoot}/company/domain/catalogs/company-resource-type.catalog.ts`,
      "utf8",
    )
    for (const resource of contextResourceCatalog) {
      expect(resource.models.length).toBeGreaterThan(0)
      expect(
        existsSync(
          resolve(import.meta.dirname, "../../app/(app)", resource.view.slice(1), "page.tsx"),
        ),
      ).toBe(true)
      for (const model of resource.models) {
        if (model.endsWith(".ts")) {
          expect(existsSync(`${domainRoot}/${resource.owner}/domain/${model}`), model).toBe(true)
        } else {
          expect(resource.owner).toBe("company")
          expect(companyTypes).toContain(`"${model}"`)
        }
      }
    }
  })
  test("全リソースが同じ名前で一度だけサイドメニューに現れる", () => {
    const navigation = getAdminNavigationItems(permissions, [])
    for (const resource of contextResourceCatalog) {
      const href = resource.view ?? `/${resource.owner}/${resource.resource}`
      const matches = navigation.filter((item) => item.href === href)
      expect(matches, href).toHaveLength(1)
      expect(matches[0].label).toBe(resource.label)
      expect(matches[0].group).toBe(resource.group)
      expect(toFeatureSpace(href)).toBe(resource.owner)
    }
    for (const owner of ["system", "company"]) {
      const resourcePaths = contextResourceCatalog
        .filter((resource) => resource.owner === owner)
        .map((resource) => resource.view ?? `/${resource.owner}/${resource.resource}`)
      expect(
        navigation
          .filter((item) => toFeatureSpace(item.href) === owner)
          .map((item) => item.href)
          .sort(),
      ).toEqual([`/${owner}`, ...resourcePaths].sort())
    }
  })
  test("認証処理・移行操作・本人専用の読み取りをリソースとして並べない", () => {
    const paths = getAdminNavigationItems(permissions, []).map((item) => item.href)
    for (const path of [
      "/system/auth",
      "/system/bootstrap",
      "/system/cli-authorization-callback",
      "/system/browser-sessions",
      "/company/bootstrap",
      "/company/my-profile",
      "/company/authority-resolutions",
      "/company/employee-resource-adoptions",
      "/system/dead-letters",
      "/system/health",
    ]) {
      expect(paths).not.toContain(path)
    }
  })
  test("既存データ画面の機能ゲートをAPI定義リンクで迂回しない", () => {
    expect(
      getAdminNavigationItems(permissions, ["accounts"]).some(
        (item) => item.href === "/system/accounts",
      ),
    ).toBe(false)
  })
  test("メニュー名に実装状態や曖昧な集約表現を混ぜない", () => {
    const menu = getAdminNavigationItems(permissions, [])
    expect(menu.filter((item) => /APIのみ|の横断|全社の|リソースの採用/.test(item.label))).toEqual(
      [],
    )
    expect(menu.filter((item) => item.href.includes("/resources"))).toEqual([])
    for (const space of ["system", "company", "composition", "apps"]) {
      const scoped = menu.filter((item) => toFeatureSpace(item.href) === space)
      expect(new Set(scoped.map((item) => item.label)).size).toBe(scoped.length)
    }
  })
})
