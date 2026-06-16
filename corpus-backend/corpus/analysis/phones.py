"""Phone classification for cross-validating alignment with linguistic priors.

The key quality check needs no gold data: vowels are, on average, longer than
plosives. If a corpus violates that, its phone alignment is suspect. To apply
the rule we must label each phone as a broad class. We support the two phone
sets our aligners emit:

  * ARPAbet / MFA english_mfa (e.g. AA, IY, P, T, SH, ...)
  * IPA-ish symbols that MFA's IPA models emit (a, i, p, t, ʃ, ...)

Pure standard library; tables are deliberately small and explicit.
"""

from __future__ import annotations

# ARPAbet vowels (CMUdict / MFA english_*). Stress digits are stripped first.
_ARPABET_VOWELS = {
    "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY",
    "IH", "IY", "OW", "OY", "UH", "UW",
}
_ARPABET_PLOSIVES = {"P", "B", "T", "D", "K", "G"}
_ARPABET_FRICATIVES = {"F", "V", "TH", "DH", "S", "Z", "SH", "ZH", "HH"}
_ARPABET_NASALS = {"M", "N", "NG"}
_ARPABET_APPROX = {"L", "R", "W", "Y"}
_ARPABET_AFFRICATES = {"CH", "JH"}

# IPA broad sets (covers the common symbols MFA IPA dictionaries produce).
_IPA_VOWELS = set("iyɨʉɯuɪʏʊeøɘɵɤoəɛœɜɞʌɔæɐaɶɑɒ")
_IPA_PLOSIVES = set("pbtdʈɖcɟkɡqɢʔ")
_IPA_FRICATIVES = set("ɸβfvθðszʃʒʂʐçʝxɣχʁħʕhɦ")
_IPA_NASALS = set("mɱnɳɲŋɴ")
_IPA_APPROX = set("ʋɹɻjɰlɭʎʟw")

# Symbols that are not speech phones (silence, MFA's spn/sil, punctuation).
_NON_PHONE = {"", "sil", "sp", "spn", "<eps>", "sounding", "noise", "<unk>"}


def normalise(label: str) -> str:
    """Strip ARPAbet stress digits and surrounding whitespace."""
    return label.strip().rstrip("0123456789").upper() if label else ""


def is_phone(label: str) -> bool:
    return label.strip().lower() not in _NON_PHONE


def phone_class(label: str) -> str:
    """Return one of: vowel, plosive, fricative, affricate, nasal, approximant,
    or 'other'. Works for both ARPAbet and IPA symbols."""
    raw = label.strip()
    if not is_phone(raw):
        return "non_speech"

    up = normalise(raw)
    if up in _ARPABET_VOWELS:
        return "vowel"
    if up in _ARPABET_PLOSIVES:
        return "plosive"
    if up in _ARPABET_AFFRICATES:
        return "affricate"
    if up in _ARPABET_FRICATIVES:
        return "fricative"
    if up in _ARPABET_NASALS:
        return "nasal"
    if up in _ARPABET_APPROX:
        return "approximant"

    # Fall back to IPA: classify by the first base character.
    base = raw[0]
    if base in _IPA_VOWELS:
        return "vowel"
    if base in _IPA_PLOSIVES:
        return "plosive"
    if base in _IPA_FRICATIVES:
        return "fricative"
    if base in _IPA_NASALS:
        return "nasal"
    if base in _IPA_APPROX:
        return "approximant"
    return "other"


def is_vowel(label: str) -> bool:
    return phone_class(label) == "vowel"


# Obstruent classes whose mean duration should fall *below* vowels.
SHORT_CLASSES = ("plosive",)
