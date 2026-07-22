from analysis.schema import AudioRef, Course, Item, Section


def test_item_to_dict_omits_absent_optional_fields():
    item = Item(id="01-001", text="hello", ja="こんにちは", ipa="həˈloʊ")
    d = item.to_dict()
    assert "audio" not in d
    assert "pos" not in d
    assert "alignment_confidence" not in d
    assert "nd" not in d
    assert "nd_l1_weighted" not in d
    assert "original_text" not in d
    assert "revision_note" not in d
    assert d["difficulty_flags"] == []


def test_item_to_dict_includes_revision_fields_only_when_note_present():
    unchanged = Item(id="01-001", text="the cat sat")
    assert "original_text" not in unchanged.to_dict()
    assert "revision_note" not in unchanged.to_dict()

    revised = Item(
        id="01-002",
        text="the cat sat on the mat",
        original_text="the cat sat on teh mat",
        revision_note="OCR誤読 'teh' を 'the' に修正",
    )
    d = revised.to_dict()
    assert d["original_text"] == "the cat sat on teh mat"
    assert d["revision_note"] == "OCR誤読 'teh' を 'the' に修正"


def test_item_to_dict_includes_nd_fields_when_present():
    item = Item(id="02-001", text="day", nd=146, nd_l1_weighted=149)
    d = item.to_dict()
    assert d["nd"] == 146
    assert d["nd_l1_weighted"] == 149


def test_item_to_dict_includes_audio_and_confidence_when_present():
    item = Item(
        id="01-001",
        text="hello",
        audio=AudioRef(file="a.wav", start=1.23456, end=2.0),
        alignment_confidence=0.987654,
    )
    d = item.to_dict()
    assert d["audio"] == {"file": "a.wav", "start": 1.235, "end": 2.0}
    assert d["alignment_confidence"] == 0.988


def test_course_to_dict_matches_agents_md_shape():
    course = Course(title="T", level="A2", source_files=["a.md"])
    course.sections.append(
        Section(
            id="01",
            content_type="dialogue",
            title="Intro",
            learning_methods=["dictation"],
            items=[Item(id="01-001", text="hi")],
        )
    )
    d = course.to_dict()
    assert set(d.keys()) == {"meta", "sections"}
    assert d["meta"] == {"title": "T", "level": "A2", "lang": "en", "source_files": ["a.md"]}
    assert d["sections"][0]["content_type"] == "dialogue"
    assert d["sections"][0]["items"][0]["id"] == "01-001"
