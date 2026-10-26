import re
import subprocess


def obj_span(lines, name):
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


# 1) 删掉 pi 里漏网的赞助商 SudoCode.us
p = "src/config/piProviderPresets.ts"
lines = open(p, encoding="utf-8").read().split("\n")
span = obj_span(lines, "SudoCode.us")
if span:
    a, b = span
    del lines[a : b + 1]
    print("removed SudoCode.us")
# 2) 删掉不再使用的 DEEPSEEK_THINKING_COMPAT 常量
text = "\n".join(lines)
text = re.sub(
    r"\nconst DEEPSEEK_THINKING_COMPAT = \{.*?\n\};\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)
open(p, "w", encoding="utf-8", newline="\n").write(text)

# 3) 恢复 Gemini 的 Google Official（官方直营，被标记清理误删）
g = "src/config/geminiProviderPresets.ts"
old = subprocess.check_output(["git", "show", "HEAD:" + g]).decode("utf-8").split("\n")
span = obj_span(old, "Google Official")
a, b = span
block = old[a : b + 1]
if block[-1] == "  }":
    block[-1] = "  },"
cur = open(g, encoding="utf-8").read().split("\n")
anchor = None
for i, l in enumerate(cur):
    if l.startswith("export const geminiProviderPresets"):
        anchor = i
        break
insert_at = anchor + 2  # 跳过注释行
cur[insert_at:insert_at] = block
open(g, "w", encoding="utf-8", newline="\n").write("\n".join(cur))
print("restored Google Official")
