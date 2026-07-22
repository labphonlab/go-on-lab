from analysis.priority import order_by_priority, score_item, word_neighborhood_density


def test_common_words_score_lower_than_rare_words():
    common = score_item("I like coffee", [])
    rare = score_item("The prosodic allophonic variation is subtle", [])
    assert common < rare


def test_l1_difficulty_flags_lower_the_score():
    base = score_item("I like tea", [])
    flagged = score_item("I like tea", ["l_r_contrast", "weak_form"])
    assert flagged < base


def test_unknown_words_default_to_mid_band():
    # made-up word, not in the frequency table (or CMUdict) at all
    score = score_item("xyzzyplugh", [])
    assert 2.5 <= score <= 3.5


def test_word_neighborhood_density_feeds_into_score_item():
    # "day" and "friend" are both band-1 words in frequency_bands_en.json,
    # but "day" has a much higher L1-weighted ND than "friend" -- real ND
    # should push "day" to a lower (earlier) score than frequency band alone
    # would predict, proving the composite isn't just re-deriving FL.
    nd_day = word_neighborhood_density("day")
    nd_friend = word_neighborhood_density("friend")
    assert nd_day[1] > nd_friend[1]

    score_day = score_item("day", [])
    score_friend = score_item("friend", [])
    assert score_day < score_friend


def test_order_by_priority_reorders_vocabulary_list():
    # index 0 is a harder/rarer sentence, index 1 an easy one — expect swap
    scored = [(0, 4.0), (1, 1.0), (2, 2.5)]
    order = order_by_priority("vocabulary_list", scored)
    assert order == [1, 2, 0]


def test_order_by_priority_leaves_dialogue_untouched():
    scored = [(0, 4.0), (1, 1.0), (2, 2.5)]
    order = order_by_priority("dialogue", scored)
    assert order == [0, 1, 2]


def test_order_by_priority_leaves_reading_and_pattern_untouched():
    scored = [(0, 3.0), (1, 0.5)]
    assert order_by_priority("reading_passage", scored) == [0, 1]
    assert order_by_priority("pattern_drill", scored) == [0, 1]
