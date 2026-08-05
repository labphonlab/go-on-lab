#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_i18n.py — tag participant-facing text in index.html for translation.

The app is one file by design, so this does not create a locale directory. It
adds a `data-i18n="<key>"` attribute to each element that shows Japanese text to
a participant, and prints the key/text pairs. The English table lives inline in
index.html as UI_EN; this tool exists to keep that table honest — run it again
after editing the markup and it reports which keys are new or gone.

Deliberately NOT tagged:
  screen-config      researcher-only, never seen by a participant
  consentBody        already overridable via CONFIG.consentBody
  instructionsBody   already overridable via CONFIG.instructionsBody

Idempotent: an element that already carries data-i18n keeps its key.

Usage:  python3 tools/extract_i18n.py [--write]
"""
import argparse
import json
import os
import re
import sys

HTML = os.path.join(os.path.dirname(__file__), "..", "index.html")
JA = re.compile(r"[぀-ゟ゠-ヿ一-鿿]")
SKIP_SECTIONS = ("screen-config",)
SKIP_IDS = ("consentBody", "instructionsBody")
# leaf elements that carry participant-visible copy
TAGGABLE = r"h1|h2|h3|h4|p|li|span|button|label|option|small|strong|div|td|th"


def participant_body(src):
    """The markup a participant can see: <body> minus the config panel."""
    start = src.index("<body")
    end = src.index("<script>")
    return start, end


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="write data-i18n back into index.html")
    args = ap.parse_args()

    src = open(HTML, encoding="utf-8").read()
    lo, hi = participant_body(src)

    # byte ranges to leave alone
    blocked = []
    for sid in SKIP_SECTIONS:
        i = src.index(f'id="{sid}"')
        j = src.index("</section>", i)
        blocked.append((i, j))
    for eid in SKIP_IDS:
        i = src.find(f'id="{eid}"')
        if i < 0:
            continue
        j = src.index("</div>", i)
        blocked.append((i, j))

    def is_blocked(pos):
        return any(a <= pos <= b for a, b in blocked)

    # which screen does an offset belong to?
    screens = [(m.start(), m.group(1))
               for m in re.finditer(r'id="(screen-[a-z-]+)"', src)]

    def screen_of(pos):
        cur = "app"
        for at, name in screens:
            if at <= pos:
                cur = name.replace("screen-", "")
            else:
                break
        return cur

    # Three shapes of participant copy, each needing its own attribute because
    # the text is not always the element's whole content:
    #   plain      <p>text</p>                        -> data-i18n     (textContent)
    #   prefixed   <label>text<span>*</span></label>  -> data-i18n-pre (first text node)
    #   suffixed   <label><input> text</label>        -> data-i18n-post(last text node)
    # plus placeholder="..." -> data-i18n-ph.
    #
    # Radio `value` attributes are deliberately left in Japanese: they are the
    # recorded response codes, so translating them would make the two language
    # arms of a study disagree about how the same answer is coded.
    pat = re.compile(
        r"<(" + TAGGABLE + r")\b([^>]*)>([^<>]+)</\1>"
        r"|<(label)\b([^>]*)>([^<>]+)(<span class=\"required\">\*</span>)</\4>"
        r"|<(label)\b([^>]*)>(<input[^>]*>)([^<>]+)</\8>"
        r"|(placeholder)=\"([^\"]+)\""
    )
    out, counts, entries = [], {}, {}
    cursor, changed = 0, 0

    for m in pat.finditer(src):
        if m.start() < lo or m.start() > hi or is_blocked(m.start()):
            continue

        if m.group(1):                       # plain
            attr, tag, attrs, text = "data-i18n", m.group(1), m.group(2), m.group(3)
            rebuild = lambda a: f"<{tag}{attrs} {a}>{text}</{tag}>"
        elif m.group(4):                     # label text + required marker
            attr, attrs, text = "data-i18n-pre", m.group(5), m.group(6)
            rebuild = lambda a: f"<label{attrs} {a}>{text}{m.group(7)}</label>"
        elif m.group(8):                     # label with leading input
            attr, attrs, text = "data-i18n-post", m.group(9), m.group(11)
            rebuild = lambda a: f"<label{attrs} {a}>{m.group(10)}{text}</label>"
        else:                                # placeholder attribute
            attr, attrs, text = "data-i18n-ph", "", m.group(13)
            rebuild = lambda a: f'placeholder="{text}" {a}'

        if not text.strip() or not JA.search(text):
            continue
        have = re.search(re.escape(attr) + r'="([^"]+)"', attrs)
        if have:
            key = have.group(1)
        else:
            sc = screen_of(m.start())
            counts[sc] = counts.get(sc, 0) + 1
            key = f"{sc}.{counts[sc]}"
            out.append(src[cursor:m.start()])
            out.append(rebuild(f'{attr}="{key}"'))
            cursor = m.end()
            changed += 1
        entries[key] = text.strip()

    out.append(src[cursor:])
    new = "".join(out)

    if args.write and changed:
        open(HTML, "w", encoding="utf-8").write(new)

    print(json.dumps(entries, ensure_ascii=False, indent=1))
    print(f"\n{len(entries)} strings, {changed} newly tagged"
          f"{' (written)' if args.write and changed else ''}", file=sys.stderr)


if __name__ == "__main__":
    main()
