from analysis.difficulty import flag_item, is_connected_speech_priority


def test_flags_l_r_contrast_from_ipa():
    flags = flag_item("light", "laɪt")
    assert "l_r_contrast" in flags


def test_flags_contraction_and_weak_form():
    flags = flag_item("I'd love a cup of coffee")
    assert "contraction" in flags
    assert "weak_form" in flags


def test_flags_reduction_slang():
    flags = flag_item("I'm gonna go now")
    assert "reduction" in flags


def test_no_flags_for_plain_simple_text():
    flags = flag_item("cat", "kæt")
    assert flags == []


def test_is_connected_speech_priority():
    assert is_connected_speech_priority(["weak_form"])
    assert not is_connected_speech_priority(["l_r_contrast"])
