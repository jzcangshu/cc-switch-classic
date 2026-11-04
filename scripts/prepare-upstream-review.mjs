import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const optionNames = [
  "upstream-base",
  "upstream-target",
  "classic-base",
  "candidate",
  "output",
];

export function prepareReview(options, cwd = process.cwd()) {
  for (const name of optionNames)
    if (!options[name]) throw new Error("缺少参数 --" + name);
  const git = (args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const repo = realpathSync(git(["rev-parse", "--show-toplevel"]).trim());
  const resolveCommit = (ref) => {
    try {
      return git([
        "rev-parse",
        "--verify",
        "--end-of-options",
        ref + "^{commit}",
      ]).trim();
    } catch {
      throw new Error("引用不是可读取的提交：" + ref);
    }
  };
  const commits = Object.fromEntries(
    optionNames.slice(0, 4).map((name) => [name, resolveCommit(options[name])]),
  );
  if (commits.candidate !== resolveCommit("HEAD"))
    throw new Error("候选必须是当前工作区的 HEAD（当前提交）");
  if (git(["status", "--porcelain", "--untracked-files=normal"]).trim())
    throw new Error("工作区有未提交改动，请先固定候选提交");
  for (const [before, after] of [
    ["upstream-base", "upstream-target"],
    ["classic-base", "candidate"],
  ]) {
    try {
      git(["merge-base", "--is-ancestor", commits[before], commits[after]]);
    } catch {
      throw new Error(before + " 不是 " + after + " 的祖先，请核实基线");
    }
  }
  let visualReference;
  try {
    visualReference = resolveCommit("v3.20.4");
  } catch {
    throw new Error("缺少 v3.20.4（视觉参照），请先获取对应官方标签");
  }
  const comparisons = [
    ["upstream", commits["upstream-base"], commits["upstream-target"]],
    ["implementation", commits["classic-base"], commits.candidate],
    ["retained", commits["upstream-target"], commits.candidate],
  ];
  const inventories = Object.fromEntries(
    comparisons.map(([name, before, after]) => [
      name,
      git(["diff", "--name-only", "-z", "--no-renames", before, after, "--"])
        .split("\0")
        .filter(Boolean),
    ]),
  );
  const output = path.resolve(cwd, options.output);
  const isInside = (directory) => {
    const relative = path.relative(repo, directory);
    return (
      relative === "" ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    );
  };
  if (isInside(output)) throw new Error("审查输出必须位于仓库外");
  mkdirSync(path.dirname(output), { recursive: true });
  if (isInside(realpathSync(path.dirname(output))))
    throw new Error("审查输出的实际父目录位于仓库内");
  const template = readFileSync(
    new URL(
      "../docs/maintenance/templates/upstream-review.md",
      import.meta.url,
    ),
    "utf8",
  );
  const metadata = {
    schemaVersion: 1,
    commits,
    visualReference,
    inventories,
    status: "unreviewed",
  };
  // 不复用或覆盖已有目录，防止把新结果混入旧报告。
  mkdirSync(output);
  writeFileSync(
    path.join(output, "scope.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  for (const [name, before, after] of comparisons) {
    writeFileSync(
      path.join(output, name + ".txt"),
      git(["diff", "--stat", before, after, "--"]) +
        "\n" +
        inventories[name].map((file) => JSON.stringify(file)).join("\n") +
        "\n",
    );
  }
  const fixed =
    "## 自动固定的审查对象\n\n" +
    Object.entries(commits)
      .map(([name, sha]) => "- " + name + "：" + sha)
      .join("\n") +
    "\n- 第三版视觉参照：" +
    visualReference +
    "\n\n差异文件清单见 scope.json（范围数据）。当前仅完成材料生成，所有质量判断和验证仍待执行。\n\n";
  writeFileSync(
    path.join(output, "review.md"),
    template.replace("## 审查输入", fixed + "## 审查输入"),
  );
  return metadata;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--") args.shift();
    const { values } = parseArgs({
      args,
      options: Object.fromEntries(
        optionNames.map((name) => [name, { type: "string" }]),
      ),
      strict: true,
    });
    const result = prepareReview(values);
    console.log(
      "审查材料已生成；候选提交 " +
        result.commits.candidate +
        "。状态：未审查。",
    );
  } catch (error) {
    console.error("审查材料生成失败：" + error.message);
    process.exitCode = 1;
  }
}
