import re

p = "src/config/piProviderPresets.ts"
lines = open(p, encoding="utf-8").read().split("\n")
objs = []
i = 0
while i < len(lines):
    if lines[i] == "  {":
        j = i
        while j < len(lines) and lines[j] not in ("  },", "  }"):
            j += 1
        objs.append((i, j))
        i = j + 1
    else:
        i += 1

rows = []
for a, b in objs:
    block = lines[a : b + 1]
    text = "\n".join(block)
    if "partnerPromotionKey:" in text or "primePartner: true" in text:
        m = re.search(r'name: "([^"]+)"', text)
        cat = re.search(r'category: "([^"]+)"', text)
        rows.append((m.group(1) if m else "?", cat.group(1) if cat else "?"))
print("marked presets:", len(rows))
for r in rows:
    print("  ", r[0], "|", r[1])
