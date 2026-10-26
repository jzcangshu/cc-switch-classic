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
}

for f in sorted(glob.glob("src/config/*ProviderPresets.ts")):
    lines = open(f, encoding="utf-8").read().split("\n")
    out = []
    i = 0
    dropped = 0
    stripped = 0
    while i < len(lines):
        if lines[i] == "  {":
            j = i
            while j < len(lines) and lines[j] not in ("  },", "  }"):
                j += 1
            block = lines[i : j + 1]
            text = "\n".join(block)
            marked = "partnerPromotionKey:" in text or "primePartner: true" in text
            name = re.search(r'name: "([^"]+)"', text)
            name = name.group(1) if name else None
            if marked and name not in KEEP:
                dropped += 1
                i = j + 1
                continue
            if marked and name in KEEP:
                cleaned = [l for l in block if l.strip() != "primePartner: true,"]
                if len(cleaned) != len(block):
                    stripped += 1
                out.extend(cleaned)
                i = j + 1
                continue
        out.append(lines[i])
        i += 1
    if dropped or stripped:
        open(f, "w", encoding="utf-8", newline="\n").write("\n".join(out))
    print(f"{os.path.basename(f)}: 再删 {dropped}，清理 primePartner {stripped}")

# 移除类型声明
for f in sorted(glob.glob("src/config/*ProviderPresets.ts")):
    text = open(f, encoding="utf-8").read()
    new = re.sub(
        r"\n *// 旧版的置顶合作伙伴标记；v7 起界面不再读取，新预设不写\n *primePartner\?: boolean;",
        "",
        text,
    )
    new = re.sub(r"\n *primePartner\?: boolean;[^\n]*", "", new)
    if new != text:
        open(f, "w", encoding="utf-8", newline="\n").write(new)
        print("type field removed:", os.path.basename(f))
