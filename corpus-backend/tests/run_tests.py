#!/usr/bin/env python3
"""Stdlib-only test runner (fallback when pytest is unavailable).

Discovers ``test_*`` functions in the sibling test modules and runs them,
reporting pass/fail. Mirrors what pytest would collect.
"""

import importlib
import os
import sys
import traceback

HERE = os.path.dirname(__file__)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..")))
sys.path.insert(0, HERE)

MODULES = ["test_audio_quality", "test_pipeline", "test_manifest",
           "test_annotation", "test_acquisition", "test_librivox",
           "test_whisperx_mapping", "test_mfa", "test_diet_jp", "test_export",
           "test_evaluation", "test_boundary_eval", "test_analysis",
           "test_formants"]


def main() -> int:
    passed = failed = 0
    failures = []
    for mod_name in MODULES:
        mod = importlib.import_module(mod_name)
        for name in sorted(dir(mod)):
            if not name.startswith("test_"):
                continue
            fn = getattr(mod, name)
            if not callable(fn):
                continue
            try:
                fn()
                passed += 1
                print(f"PASS {mod_name}::{name}")
            except Exception:  # noqa: BLE001
                failed += 1
                failures.append(f"{mod_name}::{name}")
                print(f"FAIL {mod_name}::{name}")
                traceback.print_exc()
    print(f"\n{passed} passed, {failed} failed")
    if failures:
        print("failures:", ", ".join(failures))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
