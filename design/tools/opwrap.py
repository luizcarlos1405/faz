#!/usr/bin/env python3
"""opwrap.py --port N [--fonts fonts.conf] [--dry-run]

Pre-breaks wrapped text on the document open in the OpenPencil server on --port, so exports
look right. Why: OpenPencil 0.8.4 lays text out (box height) with the real font but the PNG
renderer breaks lines with its embedded Roboto Regular metrics, so any other family overflows
the box sideways or leaves a wrong number of lines. Explicit "\\n" breaks are honoured by both.

For every text node with textGrowth fixed-width / fixed-width-height and plain-string content,
each paragraph is greedily re-broken so that every line fits the node's laid-out width under
BOTH the real font (fc-match through the same fonts.conf as the server) and Roboto. The new
content is written back with `op update`. Idempotent; rich-text (segment) content is skipped.
Requires Pillow (system python3) and fc-match.
"""
import argparse, json, os, subprocess, sys
from functools import lru_cache

from PIL import ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROBOTO = os.path.join(HERE, "..", "fonts", "breaker-Roboto-Regular.ttf")
FCW = {100: 0, 200: 40, 300: 50, 400: 80, 500: 100, 600: 180, 700: 200, 800: 205, 900: 210}
SAFETY = 0.985


def op(port, *args):
    r = subprocess.run(["op", "--port", str(port), *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"op {' '.join(args)} failed: {r.stderr or r.stdout}")
    return r.stdout


def walk(n, acc):
    acc[n["id"]] = n
    for c in n.get("children") or []:
        if isinstance(c, dict):
            walk(c, acc)


@lru_cache(None)
def font_file(family, weight, italic):
    w = int(round(float(weight) / 100.0) * 100) if str(weight).isdigit() else (700 if weight == "bold" else 400)
    pat = f"{family}:weight={FCW.get(min(max(w, 100), 900), 80)}" + (":slant=100" if italic else "")
    out = subprocess.run(["fc-match", "-f", "%{file}|%{index}|%{family[0]}", pat],
                         capture_output=True, text=True).stdout
    f, idx, got = out.split("|", 2)
    if got.replace(" ", "").lower() != family.replace(" ", "").lower():
        if family.lower() != "roboto":
            print(f"warn: '{family}' is not in fonts.conf; OpenPencil draws it with its embedded "
                  f"Roboto, measuring with that", file=sys.stderr)
        return ROBOTO, 0
    return f, int(idx or 0)


@lru_cache(None)
def pil(path, index, size):
    return ImageFont.truetype(path, size=size, index=index)


def measure(font, ls):
    return lambda s: font.getlength(s) + ls * len(s)


def rebreak(text, width, real, robo):
    out = []
    for para in text.split("\n"):
        words, line = para.split(" "), ""
        for wd in words:
            cand = f"{line} {wd}" if line else wd
            if not line or (real(cand) <= width * SAFETY and robo(cand) <= width * SAFETY):
                line = cand
            else:
                out.append(line)
                line = wd
        out.append(line)
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True)
    ap.add_argument("--fonts", help="fonts.conf; default: the one opserve.sh started this port "
                    "with, else $FONTCONFIG_FILE, else ../fonts/fonts.conf")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    rec = os.path.join(os.environ.get("OPSERVE_ROOT", "/tmp/faz-redesign/opserve"), str(a.port),
                       "fontconfig")
    fonts = (a.fonts or (open(rec).read().strip() if os.path.exists(rec) else None)
             or os.environ.get("FONTCONFIG_FILE") or os.path.join(HERE, "..", "fonts", "fonts.conf"))
    os.environ["FONTCONFIG_FILE"] = os.path.abspath(fonts)
    print(f"opwrap: fonts {os.environ['FONTCONFIG_FILE']}", file=sys.stderr)
    pages = json.loads(op(a.port, "page", "list"))
    changed = 0
    for pg in pages["pages"]:
        layout = json.loads(op(a.port, "layout", "--depth", "999", "--page", pg["id"]))["layout"]
        boxes = {}
        stack = list(layout)
        while stack:
            b = stack.pop()
            boxes[b["id"]] = b
            stack.extend(b.get("children") or [])
        doc = json.loads(op(a.port, "get", "--depth", "999", "--page", pg["id"]))
        nodes = {}
        for n in doc.get("nodes", doc if isinstance(doc, list) else []):
            walk(n, nodes)
        for nid, n in nodes.items():
            if n.get("type") != "text" or not isinstance(n.get("content"), str):
                continue
            if n.get("textGrowth") not in ("fixed-width", "fixed-width-height") or nid not in boxes:
                continue
            width = float(boxes[nid]["width"])
            size = float(n.get("fontSize") or 16)
            ls = float(n.get("letterSpacing") or 0)
            fam = n.get("fontFamily") or "Inter"
            if isinstance(fam, str) and fam.startswith("$"):
                print(f"skip {nid}: fontFamily variable {fam}", file=sys.stderr)
                continue
            path, idx = font_file(fam, n.get("fontWeight") or 400, n.get("fontStyle") == "italic")
            real = measure(pil(path, idx, size), ls)
            robo = measure(pil(ROBOTO, 0, size), ls)
            new = rebreak(n["content"], width, real, robo)
            if new != n["content"]:
                changed += 1
                print(f"{nid} [{fam} {n.get('fontWeight', 400)} {size:g}px w={width:g}] "
                      f"{n['content'][:40]!r} -> {new.count(chr(10)) + 1} lines")
                if not a.dry_run:
                    op(a.port, "update", nid, json.dumps({"content": new}), "--page", pg["id"])
    print(f"opwrap: {changed} text node(s) re-broken")


main()
