import re
import subprocess
import os

TARGETS = [
    "src/config/claudeDesktopProviderPresets.ts",
    "src/config/claudeProviderPresets.ts",
    "src/config/codexProviderPresets.ts",
    "src/config/hermesProviderPresets.ts",
    "src/config/openclawProviderPresets.ts",
    "src/config/opencodeProviderPresets.ts",
]


def find_object(lines, name):
    """返回 (start, end) —— 顶层对象，包含 name 的那一个。"""
    i = 0
    while i < len(lines):
        if lines[i] == "  {":
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count("{") - lines[j].count("}")
                if depth == 0 and j > i:
                    break
                j += 1
            block = "\n".join(lines[i : j + 1])
            m = re.search(r'name: "([^"]+)"', block)
            if m and m.group(1) == name:
                return i, j
            i = j + 1
        else:
            i += 1
    return None


for rel in TARGETS:
    old_lines = (
        subprocess.check_output(["git", "show", "HEAD:" + rel]).decode("utf-8").split("\n")
    )
    span = find_object(old_lines, "Kimi For Coding Global")
    if not span:
        print("skip (not in HEAD):", rel)
        continue
    a, b = span
    block = old_lines[a : b + 1]
    if block[-1] == "  }":
        block[-1] = "  },"
    cur = open(rel, encoding="utf-8").read().split("\n")
    anchor = find_object(cur, "Kimi For Coding")
    if not anchor:
        print("skip (no anchor):", rel)
        continue
    _, end = anchor
    if cur[end] == "  }":
        cur[end] = "  },"
    new = cur[: end + 1] + block + cur[end + 1 :]
    open(rel, "w", encoding="utf-8", newline="\n").write("\n".join(new))
    print("restored:", os.path.basename(rel))
