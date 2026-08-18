# Company Context

Company is the portable company layer. It owns legal identity, people, employment,
organization, definitions, account-to-employee links, and personnel actions. It does not own
product-specific workflows or the System account implementation.

## Dependency direction

```text
interface -> application -> domain
     |             |
     +-> infrastructure
```

- Domain is pure company policy.
- Application exposes named use cases and depends on function-shaped persistence ports.
- Infrastructure implements those ports with D1 and may know the database SDK.
- Interface owns Hono, Zod request schemas, HTTP status codes, and problem responses.
- The API root composes routes; the context never imports a product API root.

## Explicit operations

Every route and use case has a concrete name and one production file. Read and write routes for
the same resource live in separate files. Shared core functions may implement repeated policy,
but a route never selects behavior by passing a resource-type array to a generic HTTP factory.

A production TypeScript file may export at most one runtime operation: one function, one class,
or one HTTP method. It may additionally export immutable data and types. The contract test under
`test/` prevents generic route factories and multi-operation files from returning.

## HTTP contract

Zod schemas are the request contract. Hono validators expose those inferred inputs to
`hono/client` so tests and consumers use typed path, method, header, query, and JSON values.
Application and domain code do not depend on Hono or Zod.

## Safety

- Organization access and capability checks fail closed before persistence.
- Writes require an idempotency key and expected organization revision.
- Resource revisions and organization revisions are enforced again by D1.
- Organization changes validate hierarchy periods, unit references, primary assignment overlap,
  management cycles, and authority scope before writing.
- Reads at an effective date use immutable revisions rather than mutating history.
