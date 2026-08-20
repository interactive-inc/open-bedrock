import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const contextDirectory = new URL("..", import.meta.url)
const routeFiles = [
  ...new Glob("interface/routes/**/*.ts").scanSync({ cwd: contextDirectory.pathname }),
]
  .filter((file) => !file.endsWith(".test.ts"))
  .sort()

function readRoute(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(new URL(file, contextDirectory), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  )
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function collectErrorClassNames(): ReadonlySet<string> {
  const sourceFile = readRoute("interface/errors.ts")
  const names = new Set<string>()

  sourceFile.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || node.name === undefined) return

    const extendsClause = node.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword,
    )
    const parentExpression = extendsClause?.types[0]?.expression
    if (parentExpression === undefined || !ts.isIdentifier(parentExpression)) return

    if (parentExpression.text === "HTTPException" || names.has(parentExpression.text)) {
      names.add(node.name.text)
    }
  })

  return names
}

describe("System route error boundary", () => {
  test("失敗はHTTPException派生のSystemまたはOIDC errorだけをthrowする", () => {
    const allowedThrownErrors = collectErrorClassNames()
    const violations: string[] = []

    for (const file of routeFiles) {
      const sourceFile = readRoute(file)
      const visit = (node: ts.Node): void => {
        if (ts.isThrowStatement(node)) {
          const expression = node.expression
          const name =
            expression !== undefined &&
            ts.isNewExpression(expression) &&
            ts.isIdentifier(expression.expression)
              ? expression.expression.text
              : null

          if (!allowedThrownErrors.has(name ?? "")) {
            violations.push(`${file}:${lineOf(sourceFile, node)}`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }

    expect(violations).toEqual([])
  })

  test("routeは失敗Responseを直接生成しない", () => {
    const violations: string[] = []

    for (const file of routeFiles) {
      const sourceFile = readRoute(file)
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          (node.expression.name.text === "json" || node.expression.name.text === "body")
        ) {
          const status = node.arguments[1]
          if (status !== undefined) {
            const numbers: number[] = []
            const collectNumbers = (child: ts.Node): void => {
              if (ts.isNumericLiteral(child)) numbers.push(Number(child.text))
              ts.forEachChild(child, collectNumbers)
            }
            collectNumbers(status)

            if (numbers.length === 0 || numbers.some((value) => value >= 400)) {
              violations.push(`${file}:${lineOf(sourceFile, node)}`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }

    expect(violations).toEqual([])
  })
})
