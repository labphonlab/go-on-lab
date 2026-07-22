from analysis.classify import _TOOL_SCHEMA, _SYSTEM_PROMPT, HeuristicClassifier
from analysis.parser import RawSection


def _section(title, body):
    return RawSection(id="01", title=title, body=body, source_file="01.md", audio_file=None)


def test_classifies_dialogue_from_speaker_lines():
    section = _section("Cafe Talk", "A: Hello\nB: Hi there\nA: How are you?\nB: Fine, thanks.")
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "dialogue"
    assert result.items[0]["text"] == "Hello"


def test_heuristic_classifier_never_reports_revisions():
    # It's pattern-matching only -- it must never claim to have
    # corrected/completed/restructured text, since it structurally can't.
    section = _section("Cafe Talk", "A: Hello\nB: Hi there")
    result = HeuristicClassifier().classify(section)
    assert all(it["original_text"] == "" for it in result.items)
    assert all(it["revision_note"] == "" for it in result.items)


def test_tool_schema_requires_original_text_and_revision_note_fields():
    item_props = _TOOL_SCHEMA["input_schema"]["properties"]["items"]["items"]["properties"]
    required = _TOOL_SCHEMA["input_schema"]["properties"]["items"]["items"]["required"]
    assert "original_text" in item_props
    assert "revision_note" in item_props
    assert "original_text" in required
    assert "revision_note" in required


def test_system_prompt_permits_correction_but_requires_disclosure():
    assert "補完・修正・再構成" in _SYSTEM_PROMPT
    assert "original_text" in _SYSTEM_PROMPT
    assert "revision_note" in _SYSTEM_PROMPT
    # the audio-alignment safety caveat must be present
    assert "音声" in _SYSTEM_PROMPT and "アラインメント" in _SYSTEM_PROMPT


def test_dialogue_items_carry_speaker_labels_for_roleplay():
    section = _section("Cafe Talk", "A: Hello\nB: Hi there\nA: How are you?\nB: Fine, thanks.")
    result = HeuristicClassifier().classify(section)
    assert [it["speaker"] for it in result.items] == ["A", "B", "A", "B"]


def test_classifies_vocabulary_list_from_bullets():
    section = _section("Words", "- coffee\n- sugar\n- receipt")
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "vocabulary_list"
    assert [it["text"] for it in result.items] == ["coffee", "sugar", "receipt"]


def test_classifies_grammar_note_from_title_keyword():
    section = _section("Present Perfect Grammar Notes", "I have visited that cafe many times.\nShe has tried it.")
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "grammar_note"
    assert result.learning_methods == ["structured_input", "cloze_drill", "reorder_drill"]


def test_classifies_pattern_drill_from_title_keyword():
    section = _section("Ordering Drill", "I'd like a coffee.\nI'd like a tea.")
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "pattern_drill"


def test_classifies_pattern_drill_from_repeated_sentence_shape():
    section = _section(
        "Cafe Practice",
        "I'd like a coffee, please.\nI'd like a tea, please.\nI'd like a sandwich, please.",
    )
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "pattern_drill"


def test_classifies_reading_passage_from_prose_shape():
    section = _section(
        "The Cafe on Fifth Street",
        "Every morning, Maria walks to the small cafe on Fifth Street before work. "
        "The owner always remembers her order and has it ready before she reaches the counter. "
        "She likes to sit by the window and watch people hurry past on their way to the station.",
    )
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "reading_passage"
    assert len(result.items) >= 2  # split into sentences, not left as one blob
