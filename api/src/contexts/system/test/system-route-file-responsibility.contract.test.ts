import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"

const contextDirectory = new URL("..", import.meta.url)

describe("System route file responsibility contract", () => {
  test("URLをdotで表すflat fileだけを許可する", () => {
    const files = [
      ...new Glob("interface/routes/**/*.ts").scanSync({ cwd: contextDirectory.pathname }),
    ].sort()

    expect(files.filter((file) => file.split("/").length !== 3)).toEqual([])
    expect(files.filter((file) => /\/(?:route|create-route)(?:\.test)?\.ts$/.test(file))).toEqual(
      [],
    )
  })

  test("一つのURLを一つのmoduleだけが所有する", () => {
    const manifest = readFileSync(new URL("interface/route-manifest.ts", contextDirectory), "utf8")
    const modules = [...manifest.matchAll(/module: "([^"]+)"/g)].map((match) => match[1])
    const urls = [...manifest.matchAll(/path: "([^"]+)"/g)].map((match) => match[1])
    const moduleByUrl = new Map<string, Set<string>>()

    urls.forEach((url, index) => {
      const modulesForUrl = moduleByUrl.get(url) ?? new Set<string>()
      const module = modules[index]
      if (module !== undefined) modulesForUrl.add(module)
      moduleByUrl.set(url, modulesForUrl)
    })

    expect([...moduleByUrl.values()].filter((owners) => owners.size !== 1)).toEqual([])
  })
})
