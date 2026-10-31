# Public API, AI discovery, and PostgreSQL hybrid search

Research checked on 31 October 2026. This note records external capabilities and a proposed design; it does not establish that the deployed database has the required extensions, nor that any AI product has connected to this site.

Historical pre-implementation research. The implemented provider, database, backfill, expanded categories, and verification results are recorded in [the implementation report](../implementation-report.md).

## Repository evidence before implementation

- The local app uses Next.js 16.4.3 and currently declares no PostgreSQL or embedding client dependency. [package.json, lines 13–26](../../package.json#L13)
- `GET /api/jobs` already has no authentication check. Its `Cache-Control: private` header controls caching, not authorization. It remains an internal-shaped, unversioned contract; publishing a supported API requires defining that contract. [API handler, lines 5–10](../../src/app/api/jobs/route.ts#L5)
- The catalog is loaded from four JavaScript files by parsing embedded JSON, not from PostgreSQL. A read-only count on these files found **27,667 records**, including **2,343 unresolved description references**. The detail reader recognizes these references and hides them. Exclude reference strings from embeddings; use available title, organization, location, and program text instead. [snapshot loader, lines 26–54](../../src/lib/jobs.ts#L26), [description guard, lines 86–90](../../src/lib/jobs.ts#L86)
- Search currently uses weighted fields, whole-token AND matching, and title-priority ranking. It also normalizes frontend/backend/fullstack variants while retaining C++ and C#. These behaviors need deliberate coverage during migration. [search implementation, lines 7–40](../../src/lib/job-search.ts#L7)
- The homepage directly calls synchronous `getFacets()` and `searchJobs()`; detail rendering and metadata call `getJob()`. A database migration must adapt these consumers together with the API. [homepage, line 10](../../src/app/page.tsx#L10), [detail page, lines 17–25](../../src/app/lowongan/%5Bid%5D/page.tsx#L17)

These are local repository observations, not production connectivity verification. The coordinating audit also ran the existing test suite: 41 of 41 tests passed.

## Verified capabilities

The conventional path is **`/llms.txt`**, plural. The current proposal describes a concise Markdown overview with a project title, summary, guidance, and links to further agent-readable material. It complements `robots.txt` and sitemaps. It is a way to help agents understand a site when they fetch it, rather than a mechanism that registers an API or guarantees discovery by every assistant. The proposal also describes Markdown page alternatives and `rel="describedby"`/`rel="alternate"` links. [llms.txt proposal](https://llmstxt.org/)

For deliberate, repeatable API access, an application can register a search function with each model provider and execute that function against the public API. Official OpenAI documentation describes the application handling a function call and returning its output; Anthropic describes the analogous client-tool round trip; Google documents Gemini function calling for external APIs and databases. These are API integration capabilities, not evidence that the consumer ChatGPT, Claude, or Gemini apps automatically call arbitrary public endpoints after finding `llms.txt`. [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)

PostgreSQL supports native full-text search, with GIN recommended for regularly searched `tsvector` columns. `pg_trgm` adds indexed string similarity useful for misspellings and partial lexical matching. Neither capability itself provides semantic understanding. [PostgreSQL full-text indexes](https://www.postgresql.org/docs/current/textsearch-indexes.html), [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)

The pgvector project explicitly recommends combining vectors with PostgreSQL full-text search and fusing results using Reciprocal Rank Fusion (RRF) or a cross-encoder. Its current installation instructions support PostgreSQL 13+. HNSW and IVFFlat indexes support `vector` up to 2,000 dimensions, while `halfvec` indexes support up to 4,000. Extension installation and permissions still need verification on the actual database host. Approximate indexes apply filtering after scanning, which can return too few filtered results; the documentation describes iterative scans and alternatives such as exact search over selective filtered sets. [pgvector installation, hybrid search, indexing, and filtering](https://github.com/pgvector/pgvector)

## Proposed project design

These are recommendations to validate against the live repository and database:

1. Expose a versioned, read-only search endpoint returning an explicit public field allowlist, canonical detail/source URLs, pagination, and data freshness information. Bound query length and result count; add parameter validation, caching, rate limits, timeouts, and predictable errors. Configure CORS if cross-origin browser clients need access; CORS is not API authentication.
2. Publish `/llms.txt` linking to search documentation, parameter descriptions, examples, source/freshness limitations, and an OpenAPI schema. An optional `/llm.txt` redirect can accommodate the singular spelling without making it the canonical path.
3. Reuse one search service for the website and API. Run a lexical branch and a semantic branch with the same eligibility/location/education filters, combine ranked candidates with weighted RRF, and apply a deterministic tie-break. A weighted `tsvector` can emphasize role titles and skills above description text. Evaluate Indonesian and English queries before choosing text-search configuration and embedding model.
4. Maintain embeddings outside the interactive search request: backfill existing records, update only when searchable text changes, record content hashes and embedding model/version, retry failed work, and remove stale/deleted records from searchable results. Cache query embeddings and return lexical results when semantic search is unavailable.
5. Benchmark exact vector search before adding an approximate index. Verify filtered recall, latency, and ranking against representative queries, including exact companies, acronyms, typos, Indonesian paraphrases, and queries with no relevant result.

Keep lexical matching available as an explicit behavior: hybrid search intentionally expands recall beyond whole-token AND results. RRF alone does not guarantee an exact title remains first, so preserve an explicit exact-title priority if that is the desired product behavior. Define the semantic candidate cutoff, what `total` counts, stable ordering, and pagination over those candidates; otherwise nearest-neighbor results can make every record appear to match. Apply hard filters to both branches. Keep the existing opportunity `score` separate from search relevance. The initial scope can accept semantic text in `q` while keeping location and other constraints as explicit parameters; interpreting arbitrary natural-language filters is separate work.

## Effort and operating-cost dependencies

For one experienced engineer, a planning estimate based on the current repository is **1–2 working days for a supported public API and documentation**, plus **4–6 working days for PostgreSQL migration and hybrid search**, or **5–8 working days overall**. This includes migration of SSR/API callers, snapshot import, embeddings, ranking, and relevance/filter/pagination/fallback QA. These are engineering estimates, not externally sourced facts or delivery guarantees. They assume database hosting and credentials are ready, the scope uses the existing snapshot, and no live ingestion pipeline, natural-language filter parser, or separate integration in each consumer AI app is included.

Before implementation, confirm PostgreSQL version/host extension support, corpus size and update cadence, traffic expectations, fields that may be published, and an embedding provider or self-hosted model with sufficient Indonesian relevance. Provider choice and dimensions should be made together with index design.

Embedding cost depends on initial searchable corpus tokens, subsequently changed corpus tokens, and uncached query tokens. Database cost also includes vectors, indexes, and query load. Self-hosting replaces per-call embedding charges with compute and operational effort. No numeric price or quality improvement is asserted here; those require a selected model, measured corpus, traffic, and relevance baseline.
