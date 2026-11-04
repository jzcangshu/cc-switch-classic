import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  forbiddenPath,
  localLinks,
  privateMarkers,
} from "../../scripts/check-maintenance-docs.mjs";
import { prepareReview } from "../../scripts/prepare-upstream-review.mjs";

const scratchParent = process.env.MAINTENANCE_TEST_ROOT || os.tmpdir();
mkdirSync(scratchParent, { recursive: true });
const scratch = mkdtempSync(path.join(scratchParent, "maintenance-tools-"));
// 不清理用户文件；临时测试仓库保留在测试运行器的临时目录。
const repo = path.join(scratch, "repo");
mkdirSync(repo);
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
git("init", "-b", "main");
git("config", "user.name", "Maintenance Test");
git("config", "user.email", "maintenance@example.invalid");
git("config", "commit.gpgsign", "false");
git("config", "core.hooksPath", path.join(scratch, "no-hooks"));
const commit = (name) => {
  git("add", "--all");
  git("commit", "-m", name);
  return git("rev-parse", "HEAD");
};
writeFileSync(path.join(repo, "base.txt"), "base\n");
const base = commit("base");
git("tag", "v3.20.4");
writeFileSync(path.join(repo, "upstream.txt"), "upstream\n");
const target = commit("upstream");
writeFileSync(path.join(repo, "classic.txt"), "classic\n");
const candidate = commit("classic");
let outputId = 0;
const options = (overrides = {}) => ({
  "upstream-base": base,
  "upstream-target": target,
  "classic-base": base,
  candidate,
  output: path.join(scratch, "report-" + outputId++),
  ...overrides,
});

test("private file rules cover local agents, sessions and environment variants", () => {
  for (const file of [
    ".env",
    ".env.production",
    "nested/.env.local",
    ".workbuddy-ai/memory/a.md",
    "a.zcode-session",
    "private/ops.md",
    "release.key",
    "PROJECT-GUIDE-local.md",
  ])
    assert.equal(forbiddenPath(file), true, file);
  for (const file of [
    "AGENTS.md",
    "CLAUDE.md",
    "docs/maintenance/templates/private-maintenance.md",
    "docs/decisions/archived/process/2026-01-01-rule.md",
  ])
    assert.equal(forbiddenPath(file), false, file);
});

test("privacy markers distinguish actual private locations from public URLs", () => {
  assert.deepEqual(
    privateMarkers("https://github.com/example/repo and ../src/config.rs"),
    [],
  );
  assert.ok(privateMarkers("C:/Users/private-user/project").length);
  assert.ok(privateMarkers("/home/private-user/project").length);
  assert.ok(privateMarkers("https://user:password@example.invalid").length);
  assert.ok(privateMarkers("-----BEGIN PRIVATE KEY-----").length);
});

test("local links ignore code examples and retain traversal for rejection", () => {
  assert.deepEqual(
    localLinks(
      "[规则](../maintenance/review.md#section) [网站](https://example.invalid)\n~~~md\n[样例](missing.md)\n~~~\n[根](/outside.md) [越界](../../../outside.md)",
      "docs/development/a.md",
    ),
    ["docs/maintenance/review.md", "/outside.md", "../outside.md"],
  );
});

test("report records immutable commits and all three inventories without approving", () => {
  const input = options();
  const result = prepareReview(input, repo);
  assert.deepEqual(result.inventories.upstream, ["upstream.txt"]);
  assert.deepEqual(result.inventories.implementation, [
    "classic.txt",
    "upstream.txt",
  ]);
  assert.deepEqual(result.inventories.retained, ["classic.txt"]);
  assert.equal(result.visualReference, base);
  assert.equal(result.status, "unreviewed");
  assert.equal(
    JSON.parse(readFileSync(path.join(input.output, "scope.json"), "utf8"))
      .commits.candidate,
    candidate,
  );
  assert.match(
    readFileSync(path.join(input.output, "review.md"), "utf8"),
    /状态：未审查/,
  );
});

test("bad refs and reversed baselines fail before creating output", () => {
  for (const overrides of [
    { "upstream-base": "missing-ref" },
    { "upstream-base": "--help" },
    { "upstream-base": target, "upstream-target": base },
    { "classic-base": candidate, candidate: base },
  ]) {
    const input = options(overrides);
    assert.throws(() => prepareReview(input, repo));
    assert.equal(existsSync(input.output), false);
  }
});

test("output inside repository and existing output are refused", () => {
  assert.throws(
    () => prepareReview(options({ output: path.join(repo, "report") }), repo),
    /仓库外/,
  );
  const input = options();
  mkdirSync(input.output);
  writeFileSync(path.join(input.output, "keep.txt"), "original");
  assert.throws(() => prepareReview(input, repo), /EEXIST/);
  assert.equal(
    readFileSync(path.join(input.output, "keep.txt"), "utf8"),
    "original",
  );
});

test("symlinked output parent cannot place reports back inside the repository", () => {
  const alias = path.join(scratch, "repo-alias");
  symlinkSync(repo, alias, "junction");
  const input = options({ output: path.join(alias, "nested-report") });
  assert.throws(() => prepareReview(input, repo), /实际父目录/);
  assert.equal(existsSync(path.join(repo, "nested-report")), false);
});

test("missing arguments and a candidate other than HEAD are refused", () => {
  assert.throws(() => prepareReview({}, repo), /缺少参数/);
  const input = options({ candidate: target });
  assert.throws(() => prepareReview(input, repo), /候选必须/);
  assert.equal(existsSync(input.output), false);
});

test("dirty workspace cannot silently masquerade as a committed candidate", () => {
  const input = options();
  writeFileSync(path.join(repo, "uncommitted.txt"), "pending\n");
  assert.throws(() => prepareReview(input, repo), /未提交改动/);
  assert.equal(existsSync(input.output), false);
});
