import assert from "node:assert/strict";
import test from "node:test";
import { validateEmbeddings, embedTexts } from "../src/lib/server/embeddings";
import { embeddingHash, ftsText } from "../src/lib/server/embedding-text";

test("embedding output is reordered by index and rejects missing, duplicate, non-finite and zero vectors", () => {
  assert.deepEqual(validateEmbeddings({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }, 2, 2), [[1, 0], [0, 1]]);
  for (const value of [null, {}, { data: [null] }]) assert.throws(() => validateEmbeddings(value, 1, 2), { code: "EMBEDDING_INVALID_RESPONSE" });
  for (const data of [[], [{ index: 0, embedding: [1, 0] }], [{ index: 0, embedding: [1, 0] }, { index: 0, embedding: [0, 1] }], [{ index: 0, embedding: [NaN, 1] }, { index: 1, embedding: [0, 1] }], [{ index: 0, embedding: [0, 0] }, { index: 1, embedding: [0, 1] }]]) assert.throws(() => validateEmbeddings({ data }, 2, 2));
});

test("embedding requests preserve model and dimensions, and never retry authentication failures", async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-not-a-real-key";
  try {
    let calls = 0;
    const fetcher: typeof fetch = async (_input, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "openai/text-embedding-3-small");
      assert.equal(body.dimensions, 512);
      return new Response("{}", { status: 401 });
    };
    await assert.rejects(embedTexts(["query"], { fetcher, retries: 3 }), { code: "EMBEDDING_HTTP_401" });
    assert.equal(calls, 1);
  } finally { if (previous === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previous; }
});

test("FTS preserves programming languages and embedding identities include dimensions", () => {
  assert.equal(ftsText("C++ C# C front-end"), "cpluspluslang csharplang c frontend");
  assert.notEqual(embeddingHash("same", 512), embeddingHash("same", 1536));
});
