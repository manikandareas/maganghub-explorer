# Embedding model options

Checked on 31 October 2026. No models were downloaded, no inference was run, and no provider credits were used for this research.

This research predates implementation. The final choice is OpenRouter `openai/text-embedding-3-small` at 512 dimensions; see [the implementation report](../implementation-report.md) for measured backfill and evaluation results.

## Hosted options using existing credits

Mistral documents `mistral-embed` for text embeddings, with 1,024-dimensional vectors and a published standard price of **US$0.10 per million input tokens**. Calling Mistral directly is the proposed first trial given the user's existing Mistral credits; the account's model access and credit eligibility have not been tested. This recommendation does not establish Indonesian retrieval quality, which needs a representative query evaluation. [Official model and price](https://docs.mistral.ai/models/mistral-embed-23-12), [official text embeddings guide](https://docs.mistral.ai/studio/knowledge-rag/embeddings/text_embeddings)

For illustration, 27,667 jobs averaging 500 input tokens each would use 13,833,500 tokens, or about **US$1.38 for one full embedding pass**, before tax and excluding database costs, retries, updates, and queries. The 500-token average is an assumption, not a measurement of this snapshot. At the same rate, 10,000 uncached queries averaging 50 tokens would cost about US$0.05 for query embeddings.

The current public Meta Model API model catalog and API reference do **not list a dedicated embedding model or embedding endpoint**. Treat Muse developer credits as unavailable for this embedding design unless Meta documents or enables a suitable endpoint. This is a statement about the public documentation checked, not proof that no private capability exists. [Official Meta models](https://dev.meta.ai/docs/models), [official API reference](https://dev.meta.ai/docs/api-reference)

## Open-weight models on our infrastructure

Both candidates below are published under MIT according to their original model cards. Running them ourselves avoids a provider's per-token embedding charge; it still requires compute, storage, and operation of the model runtime.

| Candidate | Output dimensions | Input limit | Original weight artifact | Assessment |
| --- | ---: | ---: | --- | --- |
| `intfloat/multilingual-e5-small` | 384 | 512 tokens | `model.safetensors`, approximately 471 MB | Start here for a smaller runtime and compact job summaries. |
| `BAAI/bge-m3` | 1,024 | 8,192 tokens | `pytorch_model.bin`, approximately 2.27 GB | Alternative when longer descriptions justify a larger model. |

E5's original card states support for 100 languages and includes Indonesian (`id`) in its published retrieval evaluation. For search, documents must use the `passage: ` prefix and queries `query: `, including non-English text; the usage example normalizes embeddings. Text beyond 512 tokens is truncated. [Original E5 model card](https://huggingface.co/intfloat/multilingual-e5-small), [original model files](https://huggingface.co/intfloat/multilingual-e5-small/tree/main)

BGE-M3's original card states support for more than 100 languages and documents 1,024-dimensional dense vectors and an 8,192-token limit. Unlike E5, its queries do not require retrieval instructions. Its broader language support does not establish that it performs better on this project's Indonesian job queries. [Original BGE-M3 model card](https://huggingface.co/BAAI/bge-m3), [original model files](https://huggingface.co/BAAI/bge-m3/tree/main)

The artifact sizes are downloads, **not runtime RAM requirements**. Runtime memory also depends on precision, token length, and batch size. Latency and indexing duration need measurement on the intended CPU/GPU host; neither is asserted here.

Both dimensions fit pgvector's documented 2,000-dimension limit for standard `vector` HNSW/IVFFlat indexes. For 27,667 jobs and one float32 vector per job, the calculated raw vector payload is approximately **40.5 MiB for E5** or **108.1 MiB for BGE-M3**, excluding row overhead and indexes. [pgvector indexing documentation](https://github.com/pgvector/pgvector#hnsw)

**Deployment implication:** precomputing job vectors on a laptop only solves document indexing. Each uncached online search query also needs an embedding from the same model/version. A public hybrid API therefore needs an available model service, either colocated with the backend or served separately. Cache query embeddings and keep lexical fallback for model-service outages.

If self-hosting is selected, the proposed starting point is E5-small plus PostgreSQL full-text search. This is a resource-conscious engineering choice, not a measured quality result. Verify a small Indonesian/English relevance set before committing to a model, pin its revision, and regenerate corpus vectors when the embedding model changes. Do not mix vector spaces from different models even if their dimensions happen to match.
