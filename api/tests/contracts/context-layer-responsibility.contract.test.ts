import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync, readdirSync } from "node:fs"
import ts from "typescript"

const contextsDirectory = new URL("../../src/contexts/", import.meta.url)
const sourceDirectory = new URL("../../src/", import.meta.url)
const productionFiles = [
  ...new Glob("*/{application,infrastructure}/**/*.ts").scanSync({
    cwd: contextsDirectory.pathname,
  }),
]
  .filter(
    (file) =>
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test-support.ts") &&
      !file.includes("/infrastructure/schema/"),
  )
  .sort()

const allContextProductionFiles = [
  ...new Glob("*/**/*.ts").scanSync({ cwd: contextsDirectory.pathname }),
  ...new Glob("*/**/*.tsx").scanSync({ cwd: contextsDirectory.pathname }),
]
  .filter(
    (file) =>
      !/\.(?:test|spec)\.tsx?$/.test(file) &&
      !file.endsWith(".test-support.ts") &&
      !file.endsWith(".test-support.tsx"),
  )
  .sort()

const repositoryProductionFiles = [
  ...new Glob("contexts/*/infrastructure/repositories/**/*.repository.ts").scanSync({
    cwd: sourceDirectory.pathname,
  }),
]
  .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test-support.ts"))
  .sort()

const allRepositoryProductionFiles = [
  ...new Glob("**/*.repository.ts").scanSync({ cwd: sourceDirectory.pathname }),
]
  .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test-support.ts"))
  .sort()

const adapterProductionFiles = [
  ...new Glob("contexts/*/infrastructure/adapters/**/*.adapter.ts").scanSync({
    cwd: sourceDirectory.pathname,
  }),
]
  .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test-support.ts"))
  .sort()

const infrastructureChildDirectories = readdirSync(contextsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((context) => {
    const infrastructureDirectory = new URL(`${context.name}/infrastructure/`, contextsDirectory)

    try {
      return readdirSync(infrastructureDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${context.name}/infrastructure/${entry.name}`)
    } catch {
      return []
    }
  })
  .sort()

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
      (modifier) => modifier.kind === kind,
    ) ?? false
  )
}

type RuntimeDeclaration = Readonly<{
  kind: "class" | "function" | "variable" | "enum"
  name: string
  exported: boolean
}>

function runtimeDeclarations(sourceFile: ts.SourceFile): RuntimeDeclaration[] {
  const declarations: RuntimeDeclaration[] = []

  for (const statement of sourceFile.statements) {
    const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)

    if (ts.isClassDeclaration(statement)) {
      declarations.push({ kind: "class", name: statement.name?.text ?? "anonymous", exported })
    } else if (ts.isFunctionDeclaration(statement)) {
      declarations.push({
        kind: "function",
        name: statement.name?.text ?? "anonymous",
        exported,
      })
    } else if (ts.isVariableStatement(statement)) {
      declarations.push(
        ...statement.declarationList.declarations.map((declaration) => ({
          kind: "variable" as const,
          name: declaration.name.getText(sourceFile),
          exported,
        })),
      )
    } else if (ts.isEnumDeclaration(statement)) {
      declarations.push({ kind: "enum", name: statement.name.text, exported })
    }
  }

  return declarations
}

function classDeclarations(sourceFile: ts.SourceFile): ts.ClassLikeDeclaration[] {
  const declarations: ts.ClassLikeDeclaration[] = []

  function visit(node: ts.Node): void {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      declarations.push(node)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return declarations
}

function classNameFromFile(file: string): string {
  return file
    .split("/")
    .at(-1)!
    .replace(/\.ts$/, "")
    .replace(/\.(?:adapter|command|error|handler|repository)$/, "")
    .split("-")
    .map((part) => `${part.at(0)?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("")
}

function isApplicationErrorFile(file: string): boolean {
  return file.includes("/application/") && /\/errors(?:\/|(?:\.shared)?\.ts$)/.test(file)
}

describe("Context file responsibility contract", () => {
  test("repository suffixはcontextのaggregate repositoryだけに使う", () => {
    expect(allRepositoryProductionFiles).toEqual(repositoryProductionFiles)
  })

  test("production fileはclassを最大1つだけ定義する", () => {
    const violations = allContextProductionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, contextsDirectory), "utf8")
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      const classes = classDeclarations(sourceFile)

      return classes.length <= 1 ? [] : [`${file}: ${classes.length} classes`]
    })

    expect(violations).toEqual([])
  })

  test("Application・Repository・Adapterのconstructorはc: Contextだけを受け取る", () => {
    const violations = productionFiles
      .filter(
        (file) =>
          !isApplicationErrorFile(file) &&
          (file.includes("/application/") ||
            file.endsWith(".repository.ts") ||
            file.endsWith(".adapter.ts")),
      )
      .flatMap((file) => {
        const source = readFileSync(new URL(file, contextsDirectory), "utf8")
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

        return sourceFile.statements.filter(ts.isClassDeclaration).flatMap((declaration) => {
          const constructor = declaration.members.find(ts.isConstructorDeclaration)
          if (constructor === undefined) return []

          const parameter = constructor.parameters[0]
          const valid =
            constructor.parameters.length === 1 &&
            parameter !== undefined &&
            ts.isIdentifier(parameter.name) &&
            parameter.name.text === "c" &&
            parameter.type?.getText(sourceFile) === "Context" &&
            hasModifier(parameter, ts.SyntaxKind.PrivateKeyword) &&
            hasModifier(parameter, ts.SyntaxKind.ReadonlyKeyword)

          return valid
            ? []
            : [
                `${file}: ${declaration.name?.text ?? "anonymous"} constructor must be private readonly c: Context`,
              ]
        })
      })

    expect(violations).toEqual([])
  })

  test("Infrastructure直下のdirectoryは技術的責務だけにする", () => {
    const allowedDirectoryNames = new Set(["adapters", "errors", "repositories", "schema"])

    expect(
      infrastructureChildDirectories.filter(
        (directory) => !allowedDirectoryNames.has(directory.split("/").at(-1)!),
      ),
    ).toEqual([])
  })

  test("Infrastructureのproduction実装をrepositoriesとadaptersへ分離する", () => {
    expect(
      productionFiles.filter(
        (file) =>
          file.includes("/infrastructure/") &&
          !(file.includes("/infrastructure/repositories/") && file.endsWith(".repository.ts")) &&
          !(
            file.includes("/infrastructure/adapters/") &&
            (file.endsWith(".adapter.ts") || file.endsWith(".shared.ts"))
          ) &&
          !(file.includes("/infrastructure/errors/") && file.endsWith(".error.ts")) &&
          !/^[^/]+\/infrastructure\/errors(?:\.shared)?\.ts$/.test(file),
      ),
    ).toEqual([])
  })

  test("RepositoryはDomain Entityを永続化するXxxRepository classだけを公開する", () => {
    const violations = repositoryProductionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, sourceDirectory), "utf8")
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      const exportedRuntimeDeclarations = runtimeDeclarations(sourceFile).filter(
        (declaration) => declaration.exported,
      )
      const hasOnlyRepositoryClasses = exportedRuntimeDeclarations.every(
        (declaration) => declaration.kind === "class" && declaration.name.endsWith("Repository"),
      )
      const expectedClassName = `${classNameFromFile(file)}Repository`
      const hasSingleMatchingRepositoryClass =
        exportedRuntimeDeclarations.length === 1 &&
        exportedRuntimeDeclarations[0]?.name === expectedClassName

      const isAggregateRepository =
        file.includes("/infrastructure/repositories/") &&
        source.includes("/domain/entities/") &&
        !/R2_BUCKET|\bfetch\s*\(|\.env\.EMAIL\b/.test(source)

      if (hasSingleMatchingRepositoryClass && hasOnlyRepositoryClasses && isAggregateRepository) {
        return []
      }

      return [
        `${file}: expected class ${expectedClassName}; ${
          exportedRuntimeDeclarations
            .map((declaration) => `${declaration.kind} ${declaration.name}`)
            .join(", ") || "no exported runtime declaration"
        }`,
      ]
    })

    expect(violations).toEqual([])
  })

  test("AdapterはXxxAdapter classだけをadaptersへ公開する", () => {
    const violations = adapterProductionFiles.flatMap((file) => {
      const source = readFileSync(new URL(file, sourceDirectory), "utf8")
      const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      const exportedRuntimeDeclarations = runtimeDeclarations(sourceFile).filter(
        (declaration) => declaration.exported,
      )
      const hasOnlyAdapterClasses = exportedRuntimeDeclarations.every(
        (declaration) => declaration.kind === "class" && declaration.name.endsWith("Adapter"),
      )

      return file.includes("/infrastructure/adapters/") &&
        exportedRuntimeDeclarations.length > 0 &&
        hasOnlyAdapterClasses
        ? []
        : [
            `${file}: ${
              exportedRuntimeDeclarations
                .map((declaration) => `${declaration.kind} ${declaration.name}`)
                .join(", ") || "no exported runtime declaration"
            }`,
          ]
    })

    expect(violations).toEqual([])
  })

  test("ApplicationはDomain modelを経由するwrite classだけにする", () => {
    const readOperationName =
      /^(?:Read|List|Get|Find|Resolve|Fetch|Query|Search|Download|Preview|Generate|Export|Authenticate|Assert|Prepare)/
    const violations = productionFiles
      .filter((file) => file.includes("/application/") && !isApplicationErrorFile(file))
      .flatMap((file) => {
        const source = readFileSync(new URL(file, contextsDirectory), "utf8")
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
        const declarations = runtimeDeclarations(sourceFile)
        const classes = sourceFile.statements.filter(ts.isClassDeclaration)
        const exportedClasses = classes.filter((declaration) =>
          hasModifier(declaration, ts.SyntaxKind.ExportKeyword),
        )
        const className = exportedClasses[0]?.name?.text ?? "anonymous"
        const imports = sourceFile.statements
          .filter(ts.isImportDeclaration)
          .map((declaration) => declaration.moduleSpecifier)
          .filter(ts.isStringLiteral)
          .map((specifier) => specifier.text)
        const forbiddenImports = imports.filter(
          (specifier) =>
            specifier === "hono" ||
            specifier.startsWith("hono/") ||
            specifier === "drizzle-orm" ||
            specifier.startsWith("drizzle-orm/") ||
            specifier.includes("/infrastructure/schema/") ||
            specifier.includes("/interface/") ||
            specifier.startsWith("@/api"),
        )
        const constructor = exportedClasses[0]?.members.find(ts.isConstructorDeclaration)
        const freezesInstance =
          constructor?.body?.statements.some(
            (statement) => statement.getText(sourceFile) === "Object.freeze(this)",
          ) ?? false

        return [
          ...(declarations.length === 1 &&
          declarations[0]?.kind === "class" &&
          declarations[0].exported &&
          classes.length === 1
            ? []
            : [
                `${file}: runtime declarations=${declarations
                  .map(
                    (declaration) =>
                      `${declaration.exported ? "export " : ""}${declaration.kind} ${declaration.name}`,
                  )
                  .join(", ")}`,
              ]),
          ...(className === classNameFromFile(file)
            ? []
            : [`${file}: class ${className} does not match file`]),
          ...(readOperationName.test(className) ? [`${file}: read operation ${className}`] : []),
          ...(imports.some((specifier) => specifier.includes("/domain/"))
            ? []
            : [`${file}: Domain model is not used`]),
          ...(forbiddenImports.length === 0
            ? []
            : [`${file}: forbidden imports ${forbiddenImports.join(", ")}`]),
          ...(/\bD1(?:Database|PreparedStatement)\b|\.var\.database|\.env\.DB/.test(source)
            ? [`${file}: direct database dependency`]
            : []),
          ...(freezesInstance ? [] : [`${file}: instance is not frozen`]),
          ...(/usecase/i.test(source) ? [`${file}: useCase naming`] : []),
        ]
      })

    expect(violations).toEqual([])
  })

  test("Applicationのerrors fileはError classとerror変換functionだけを公開する", () => {
    const violations = productionFiles
      .filter((file) => file.includes("/application/") && isApplicationErrorFile(file))
      .flatMap((file) => {
        const source = readFileSync(new URL(file, contextsDirectory), "utf8")
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

        return runtimeDeclarations(sourceFile)
          .filter((declaration) => declaration.exported)
          .flatMap((declaration) =>
            (declaration.kind === "class" && declaration.name.endsWith("Error")) ||
            (file.endsWith("errors.shared.ts") &&
              declaration.kind === "function" &&
              /^to\w+ApplicationError(?:Body)?$/.test(declaration.name)) ||
            (file.endsWith("errors.shared.ts") &&
              declaration.kind === "variable" &&
              /^[A-Z][A-Z0-9_]+$/.test(declaration.name))
              ? []
              : [`${file}: ${declaration.kind} ${declaration.name}`],
          )
      })

    expect(violations).toEqual([])
  })

  test("operationをuseCaseと呼ばない", () => {
    const forbiddenName = new RegExp(`\\b${["use", "case"].join("")}\\b`, "i")

    expect(
      allContextProductionFiles.filter((file) =>
        forbiddenName.test(readFileSync(new URL(file, contextsDirectory), "utf8")),
      ),
    ).toEqual([])
  })
})
