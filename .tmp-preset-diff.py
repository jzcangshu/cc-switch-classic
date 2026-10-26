import re
import glob
import os
import subprocess


def names_from_text(text):
    lines = text.split("\n")
    out = []
    i = 0
    while i < len(lines):
        if lines[i] == "  {":
            j = i
            depth = 0
            while j < len(lines):
                depth += lines[j].count("{") - lines[j].count("}")
                if depth == 0 and j > i:
                    break
                j += 1
            block = "\n".join(lines[i : j + 1])
            m = re.search(r'name: "([^"]+)"', block)
            if m:
                out.append(m.group(1))
            i = j + 1
        else:
            i += 1
    return out


for f in sorted(glob.glob("src/config/*ProviderPresets.ts")):
    rel = f.replace("\\", "/")
    old = subprocess.check_output(["git", "show", "HEAD:" + rel]).decode("utf-8")
    new = open(f, encoding="utf-8").read()
    a, b = names_from_text(old), names_from_text(new)
    removed = [n for n in a if n not in b]
    added = [n for n in b if n not in a]
    print(f"{os.path.basename(f)}: HEAD {len(a)} -> {len(b)}  删除 {len(removed)}  新增 {len(added)}")
    keep_expected = {
        "Kimi",
        "Kimi Global",
        "Kimi For Coding",
        "Kimi For Coding Global",
        "火山 Agent Plan",
        "火山 Coding Plan",
        "Volcengine Doubao",
        "BytePlus",
    }
    unexpected = [n for n in removed if n in keep_expected]
    if unexpected:
        print("   !! 误删官方预设:", unexpected)
    if added:
        print("   ?? 新增:", added)
