import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const entryNames = ["AGENT.md", "CLAUDE.md", "GEMINI.md", "CODEBUDDY.md"];
const required = [
  "AGENTS.md",
  "README.md",
  ".github/pull_request_template.md",
  "CONTRIBUTING.md",
  "MAINTENANCE.md",
  "docs/README.md",
  ...entryNames,
  ".github/copilot-instructions.md",
  ...[
    "project-contract",
    "development",
    "upstream-sync",
    "review",
    "release",
    "documentation",
  ].map((name) => "docs/maintenance/" + name + ".md"),
  "docs/maintenance/templates/private-maintenance.md",
  "docs/maintenance/templates/upstream-review.md",
  "docs/decisions/implemented/process/2026-11-04-maintenance-docs.md",
  "docs/development/kimi-code-integration.md",
  "src/whats-new/README.md",
];

export function forbiddenPath(file) {
  return (
    /(^|\/)(\.env(?:\..*)?|\.private|private|\.workbuddy-ai|\.zcode|\.claude|\.codex|\.gemini|\.agents)(\/|$)/i.test(
      file,
    ) ||
    /(^|\/)(?:MAINTENANCE\.private\.md|PROJECT-GUIDE-[^/]+\.md)$/i.test(file) ||
    /\.(?:zcode-session|key|p12|pfx|pem)$/i.test(file) ||
    /^(?:archives?|review-artifacts)\//i.test(file)
  );
}

export function privateMarkers(text) {
  const rules = [
    ["个人绝对目录", /(?:\b[a-z]:[\\/]|\/(?:Users|home)\/)[^\s<>\x60]+/i],
    ["私钥正文", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
    [
      "访问令牌",
      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
    ],
    ["带认证信息的网址", /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ];
  return rules.filter(([, rule]) => rule.test(text)).map(([name]) => name);
}

export function localLinks(text, file) {
  const result = [];
  const prose = text.replace(
    /^(?:\x60{3}|~{3})[^\n]*\n[\s\S]*?^(?:\x60{3}|~{3})\s*$/gm,
    "",
  );
  for (const match of prose.matchAll(
    /\[[^\]]*\]\((<?[^\s)]+>?)(?:\s+"[^"]*")?\)/g,
  )) {
    let target = match[1].replace(/^<|>$/g, "");
    if (/^(?:[a-z]+:|#|\/\/)/i.test(target)) continue;
    target = decodeURIComponent(target.split(/[?#]/)[0]);
    if (!target) continue;
    result.push(
      path.posix
        .normalize(
          target.startsWith("/")
            ? target
            : path.posix.join(path.posix.dirname(file), target),
        )
        .replace(/\/$/, ""),
    );
  }
  return result;
}

export function checkRepository(root) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  const files = [
    ...new Set(
      (
        git(["ls-files", "-z"]) +
        git(["ls-files", "--others", "--exclude-standard", "-z"])
      )
        .split("\0")
        .filter(Boolean),
    ),
  ];
  const available = new Set(files);
  const errors = [];
  for (const file of files) {
    if (forbiddenPath(file)) errors.push(file + "：私人文件或原始材料不得入库");
    if (
      /(^|\/)AGENTS?\.md$/.test(file) &&
      !["AGENTS.md", "AGENT.md"].includes(file)
    ) {
      errors.push(file + "：新增目录级助手入口须先纳入公开阅读路由和检查器");
    }
  }
  for (const file of required)
    if (!available.has(file))
      errors.push(file + "：入口或规则文件未纳入公开提交范围");
  const governed = files.filter(
    (file) =>
      required.includes(file) ||
      /^docs\/(?:maintenance|decisions|development)\/.*\.md$/.test(file),
  );
  const graph = new Map();
  for (const file of governed) {
    let text;
    try {
      if (lstatSync(path.join(root, file)).isSymbolicLink()) {
        errors.push(file + "：公开规范不得是指向其他位置的符号链接");
        continue;
      }
      text = readFileSync(path.join(root, file), "utf8");
    } catch {
      errors.push(file + "：文件已缺失，检查迁移及暂存状态");
      continue;
    }
    for (const marker of privateMarkers(text))
      errors.push(file + "：包含" + marker + "，请人工核查");
    let links;
    try {
      links = localLinks(text, file);
    } catch {
      errors.push(file + "：链接编码无效");
      continue;
    }
    graph.set(file, links);
    for (const target of links) {
      if (
        target.startsWith("../") ||
        path.posix.isAbsolute(target) ||
        (!available.has(target) &&
          !files.some((item) => item.startsWith(target + "/")))
      ) {
        errors.push(file + "：无效或未公开的链接 " + target);
      }
    }
    if (/^docs\/decisions\//.test(file)) {
      const parts = file.split("/");
      if (
        !/^(proposed|implemented|rejected|archived)$/.test(parts[2]) ||
        !/^(feature|bug-fix|simplification|architecture|process|testing)$/.test(
          parts[3],
        ) ||
        !/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(parts[4] || "") ||
        parts.length !== 5
      ) {
        errors.push(file + "：决策目录、类别或日期命名无效");
      }
      if (
        !text.startsWith("# Agent Note:") ||
        !text.split("\n")[2]?.startsWith("Status: " + parts[2])
      ) {
        errors.push(file + "：决策头块与生命周期不一致");
      }
      for (const heading of [
        "Problem",
        "Alternatives considered",
        ["implemented", "archived"].includes(parts[2])
          ? "Decision"
          : "Proposal",
      ]) {
        if (!new RegExp("^## " + heading + "(?:（.*）)?$", "m").test(text))
          errors.push(file + "：缺少决策章节 " + heading);
      }
      if (
        parts[2] === "implemented" &&
        (!/^## Consequences(?:（.*）)?$/m.test(text) ||
          /^## (?:Proposal|Plan|Acceptance criteria)(?:（.*）)?$/m.test(text))
      ) {
        errors.push(file + "：已实施决策必须记录后果且不能保留提案章节");
      }
    }
  }
  for (const file of [...entryNames, ".github/copilot-instructions.md"]) {
    if (!available.has(file)) continue;
    const target = file.startsWith(".github/") ? "../AGENTS.md" : "AGENTS.md";
    const expected =
      "# 开发助手兼容入口\n\n先读取 [AGENTS.md（统一入口）](" +
      target +
      ")，按其中的任务阶段继续。本文不设独立规则。\n";
    if (
      readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n") !==
      expected
    )
      errors.push(file + "：兼容入口只能跳转统一入口");
  }
  const reached = new Set();
  const visit = (file) => {
    if (reached.has(file)) return;
    reached.add(file);
    for (const next of graph.get(file) || []) visit(next);
  };
  visit("AGENTS.md");
  for (const file of governed) {
    if (
      !entryNames.includes(file) &&
      file !== ".github/copilot-instructions.md" &&
      !reached.has(file)
    )
      errors.push(file + "：无法从统一入口找到");
  }
  return errors;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const errors = checkRepository(process.cwd());
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else
      console.log(
        "维护文档检查通过：入口、规则归属、链接与公开文件范围有效；提交前仍须人工核查敏感信息。",
      );
  } catch (error) {
    console.error("维护文档检查失败：" + error.message);
    process.exitCode = 1;
  }
}
