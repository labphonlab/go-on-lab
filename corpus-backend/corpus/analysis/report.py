"""Unified quality report — binds every validation into one publishable card.

Combines the corpus profile (coverage, acoustics, labels, duration alignment
check), the vowel-space verdict, and optionally measured WER/CER and boundary
accuracy. This is the single artefact a researcher reads to decide if a corpus
is fit to use or publish — and the readiness verdict gates that decision.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .profile import CorpusProfile, render_markdown as render_profile
from .vowel_space import VowelSpaceResult


@dataclass
class QualityReport:
    profile: CorpusProfile
    vowel_space: VowelSpaceResult | None = None
    error_rates: dict | None = None       # ErrorRateResult.as_dict()
    boundary: dict | None = None          # BoundaryResult.as_dict()

    def blocking_issues(self) -> list[str]:
        """Hard reasons a corpus is not ready (error-level)."""
        issues = [f"{f.code}: {f.message}"
                  for f in self.profile.flags if f.level == "error"]
        if self.vowel_space and self.vowel_space.ordering_ok is False:
            issues.append("vowel_space_misordered: /i/ vs /a/ contrast is wrong")
        return issues

    def is_ready(self) -> bool:
        return not self.blocking_issues()

    def as_dict(self) -> dict:
        return {
            "ready": self.is_ready(),
            "blocking_issues": self.blocking_issues(),
            "profile": self.profile.as_dict(),
            "vowel_space": self.vowel_space.as_dict() if self.vowel_space else None,
            "error_rates": self.error_rates,
            "boundary": self.boundary,
        }


def render_report(report: QualityReport, name: str = "Go-on Lab Corpus") -> str:
    L = [f"# {name} — Quality Report", ""]
    if report.is_ready():
        L += ["> ✅ **READY** — no blocking issues found.", ""]
    else:
        L += ["> 🛑 **NOT READY** — resolve the blocking issues below.", ""]
        for issue in report.blocking_issues():
            L.append(f"> - {issue}")
        L.append("")

    # Label quality (WER/CER)
    if report.error_rates:
        e = report.error_rates
        L += ["## Label quality (sampled)", "",
              f"- WER: {e['wer']:.1%}  CER: {e['cer']:.1%}  "
              f"(n={e['n_segments']})", ""]
    # Alignment boundary accuracy
    if report.boundary:
        b = report.boundary
        within = b.get("within", {})
        L += ["## Alignment boundary accuracy", "",
              f"- mean error {b['mean_abs_error_ms']} ms; "
              f"within 20 ms: {within.get('20ms', 'n/a')}", ""]
    # Vowel space
    if report.vowel_space:
        v = report.vowel_space
        L += ["## Vowel space (F1/F2)", "",
              f"- vowels measured: {v.n_vowels_measured}",
              f"- ordering correct: {v.ordering_ok}",
              f"- mean target error: {v.mean_target_error_hz} Hz", ""]

    # Fold in the full profile body (coverage / acoustics / phonetics).
    L.append(render_profile(report.profile, name=name))
    return "\n".join(L)
