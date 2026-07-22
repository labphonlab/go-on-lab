from analysis.classify import HeuristicClassifier
from analysis.parser import RawSection


def _section(title, body):
    return RawSection(id="01", title=title, body=body, source_file="01.md", audio_file=None)


def test_classifies_dialogue_from_speaker_lines():
    section = _section("Cafe Talk", "A: Hello\nB: Hi there\nA: How are you?\nB: Fine, thanks.")
    result = HeuristicClassifier().classify(section)
    assert result.content_type == "dialogue"
    assert result.items[0]["text"] == "Hello"


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
