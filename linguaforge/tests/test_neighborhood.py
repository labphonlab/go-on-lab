from analysis.neighborhood import (
    NeighborIndex,
    compute_l1_weighted_nd,
    compute_nd,
    default_canonical_index,
    default_index,
    get_pronunciation,
)


def test_get_pronunciation_known_word():
    assert get_pronunciation("cat") == ("K", "AE", "T")


def test_get_pronunciation_unknown_word_returns_none():
    assert get_pronunciation("xyzzyplughqqq") is None


def test_compute_nd_on_small_hand_built_population():
    # cat=K AE T; bat/hat are one substitution away; "at" is one deletion away.
    population = ["cat", "bat", "hat", "at", "dog"]
    index = NeighborIndex(population, canonical=False)
    nd = compute_nd("cat", index)
    assert nd == 3  # bat, hat, at -- not dog, not cat itself


def test_compute_nd_none_for_word_not_in_cmudict():
    index = NeighborIndex(["cat", "bat"], canonical=False)
    assert compute_nd("xyzzyplughqqq", index) is None


def test_cat_has_higher_nd_than_an_obscure_long_word():
    index = default_index()
    nd_cat = compute_nd("cat", index)
    nd_obscure = compute_nd("zeitgeist", index)
    assert nd_cat is not None and nd_obscure is not None
    assert nd_cat > nd_obscure


def test_l1_weighted_nd_is_never_less_than_plain_nd():
    index = default_index()
    canonical_index = default_canonical_index()
    for word in ["light", "right", "very", "belly", "cat", "vote", "thin", "receipt", "coffee"]:
        nd = compute_nd(word, index)
        if nd is None:
            continue
        l1_nd = compute_l1_weighted_nd(word, canonical_index)
        assert l1_nd is not None
        assert l1_nd >= nd, f"{word}: l1_weighted_nd={l1_nd} < nd={nd}"


def test_l1_weighted_nd_finds_neighbors_normal_nd_cannot():
    # very=V EH R IY, belly=B EH L IY: edit distance 2 in the plain alphabet
    # (V/B and R/L both differ) so "belly" is NOT a normal neighbor of
    # "very" -- but both positions are L1 merge-pairs, so canonicalizing
    # collapses them to the identical sequence (distance 0). This is the
    # concrete case that proves L1-weighting adds real neighbors, not just
    # re-counts ones already found by compute_nd.
    index = default_index()
    canonical_index = default_canonical_index()

    nd = compute_nd("very", index)
    l1_nd = compute_l1_weighted_nd("very", canonical_index)
    assert nd is not None and l1_nd is not None
    assert l1_nd > nd
