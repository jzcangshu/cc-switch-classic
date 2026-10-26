import re
import glob
import os

KEEP = {
    "Kimi",
    "Kimi Global",
    "Kimi For Coding",
    "火山 Agent Plan",
    "火山 Coding Plan",
    "Volcengine Doubao",
    "BytePlus",
    "Google Official",
}

NEW_COMMENT = "  // ===== 官方直营预设（赞助商预设已于 2026-10-26 按决策整体删除，见 MAINTENANCE.md）=====\n"


def split_objects(lines):
    """把 [start,end) 之间的顶层对象切成 (开始行, 结束行) 段。"""
    objs = []
    i = 0
    while i < len(lines):
        if lines[i].rstrip("\n") == "  {":
            j = i
            while j < len(lines) and lines[j].rstrip("\n") not in ("  },", "  }"):
                j += 1
            objs.append((i, j))
            i = j + 1
        else:
            i += 1
    return objs


def name_of(block):
    m = re.search(r'name: "([^"]+)"', "\n".join(block))
    return m.group(1) if m else None


for f in sorted(glob.glob("src/config/*ProviderPresets.ts")):
    raw = open(f, encoding="utf-8").read()
    lines = raw.split("\n")
    start = None
    for i, l in enumerate(lines):
        if "===== 赞助商预设" in l:
            start = i
            break
    if start is None:
        print("SKIP (no sponsor section):", os.path.basename(f))
        continue
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if lines[j].startswith("  // =====") or lines[j].startswith("];"):
            end = j
            break
    body = lines[start + 1 : end]
    objs = split_objects(body)
    kept = []
    dropped = 0
    for a, b in objs:
        block = body[a : b + 1]
        nm = name_of(block)
        if nm in KEEP:
            kept.append("\n".join(block))
        else:
            dropped += 1
    print(f"{os.path.basename(f)}: 共 {len(objs)}，保留 {len(kept)}，删除 {dropped}")
    print("   保留:", [name_of(k.split("\n")) for k in kept])
    new_body = []
    if kept:
        new_body.append(NEW_COMMENT.rstrip("\n"))
        new_body.extend(kept)
    new_lines = lines[:start] + new_body + lines[end:]
    open(f, "w", encoding="utf-8", newline="\n").write("\n".join(new_lines))
