import assert from "node:assert/strict";
import test from "node:test";
import { createSearchDocument, createSearchQuery, normalizeSearchText, rankSearch } from "../src/lib/job-search";

const document = (title: string, description = "", organization = "") => createSearchDocument({ title, description, organization, location: "", programs: "" });

test("short technical terms never match parts of unrelated words", () => {
  for (const [query, title] of [["ai", "maintenance desain perbaikan"], ["it", "digital kualitas"], ["ui", "equipment suite"], ["hr", "through"]])
    assert.equal(rankSearch(document(title), createSearchQuery(query)), null, query);
  for (const title of ["AI Engineer", "AI/ML Engineer", "AI_Engineer"])
    assert.ok(rankSearch(document(title), createSearchQuery("AI engineer")), title);
});

test("normalization keeps meaningful programming language tokens", () => {
  assert.equal(normalizeSearchText("C++ / C# / UI-UX"), "c++ c# ui ux");
  assert.ok(rankSearch(document("C++ Developer"), createSearchQuery("c++")));
  assert.equal(rankSearch(document("C# Developer"), createSearchQuery("c++")), null);
});

test("punctuation, Unicode variants, and compound role names normalize consistently", () => {
  assert.equal(normalizeSearchText("ＡＩ Engineer_RSB"), "ai engineer rsb");
  for (const word of ["front-end", "front end", "front/end", "frontend"])
    assert.equal(normalizeSearchText(word), "frontend");
  assert.equal(normalizeSearchText("back-end full stack"), "backend fullstack");
});

test("exact title outranks phrase, then all title tokens, then description", () => {
  const query = createSearchQuery("ai engineer");
  const titles = [document("AI Engineer"), document("Junior AI Engineer"), document("AI/ML Engineer"), document("QA Engineer", "Testing AI products")];
  const tiers = titles.map(item => rankSearch(item, query)![0]);
  assert.deepEqual(tiers, [4, 3, 2, 1]);
  assert.equal(rankSearch(document("AI Engineer"), createSearchQuery("ai engineer jakarta")), null);
});

test("a matching organization ranks above an incidental description mention", () => {
  const query = createSearchQuery("garuda digital");
  const employer = rankSearch(document("Intern", "", "Garuda Digital"), query)!;
  const mention = rankSearch(document("Intern", "Berkoordinasi dengan Garuda Digital"), query)!;
  assert.equal(employer[0], mention[0]);
  assert.ok(employer[1] > mention[1]);
});

test("empty searches keep portal order; punctuation-only searches match nothing", () => {
  assert.deepEqual(rankSearch(document("Perawat"), createSearchQuery("  ")), [0, 0]);
  assert.equal(rankSearch(document("Perawat"), createSearchQuery("?!")), null);
});
