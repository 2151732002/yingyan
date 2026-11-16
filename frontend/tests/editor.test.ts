import { test } from "node:test";
import assert from "node:assert/strict";
import { moveItem, countWords } from "../lib/editor.ts";
test("moving a shot preserves stable identities and does not mutate the saved list", () => {
  const old = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    moveItem(old, 2, 0).map((x) => x.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    old.map((x) => x.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(moveItem(old, 0, -1), old);
});
test("story count excludes whitespace while retaining Chinese characters", () => {
  assert.equal(countWords("雨夜\n 咖啡馆。"), 6);
});
