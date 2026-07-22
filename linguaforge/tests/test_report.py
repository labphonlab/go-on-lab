from datetime import datetime, timezone

from analysis.report import render_report
from analysis.schema import Course, Item, Section


def test_render_report_includes_rationale_and_warnings():
    course = Course(title="Sample", level="A2", source_files=["01_intro.md"])
    course.sections.append(
        Section(
            id="01",
            content_type="dialogue",
            title="Intro",
            learning_methods=["dictation", "shadowing"],
            rationale="気づき仮説に基づく",
            items=[Item(id="01-001", text="Hello", ja="こんにちは", ipa="həˈloʊ")],
        )
    )

    report = render_report(course, ["section 01: MFA not installed"], generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc))

    assert "気づき仮説に基づく" in report
    assert "MFA not installed" in report
    assert "Hello" in report and "こんにちは" in report


def test_render_report_shows_no_warnings_message_when_clean():
    course = Course(title="Sample", level="A2", source_files=[])
    report = render_report(course, [], generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert "警告なし" in report


def test_render_report_shows_nd_columns_and_oov_list():
    course = Course(title="Sample", level="A2", source_files=[])
    course.sections.append(
        Section(
            id="02",
            content_type="vocabulary_list",
            title="Vocab",
            learning_methods=["flashcard"],
            items=[
                Item(id="02-001", text="day", nd=146, nd_l1_weighted=149),
                Item(id="02-002", text="xyzzyplugh"),  # OOV, nd stays None
            ],
        )
    )

    report = render_report(
        course, [], generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc), oov_words=["xyzzyplugh"]
    )

    assert "146" in report and "149" in report
    assert "CMUdict未収載語" in report
    assert "xyzzyplugh" in report


def test_render_report_no_oov_message_when_none_given():
    course = Course(title="Sample", level="A2", source_files=[])
    report = render_report(course, [], generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert "未収載語なし" in report
