# Consent & Licensing Model

For a corpus to be **sellable**, every clip must carry an unbroken chain of
rights from the contributor to the buyer. This is the legal core of the system;
treat it as a hard requirement, not a feature.

## 1. The chain of rights

```
Contributor  ──consent──▶  Go-on Lab  ──corpus license──▶  Researcher / Buyer
   (speaker)                (collector)                       (licensee)
```

Two distinct instruments must both exist for every `CorpusItem`:

1. **ConsentRecord** — what the *speaker* granted. Captured at recording time,
   versioned, and immutable. Must explicitly state:
   - `commercial_use` — may the recording be sold / used commercially?
   - `redistribution` — may it be redistributed to third parties?
   - `derivatives` — may derived data (alignments, features) be created/shared?
   - `retention` & `withdrawal` — storage period and the right to withdraw.
   - jurisdiction (GDPR / 個人情報保護法 / CCPA …) and lawful basis.
2. **License** — the licence under which the *corpus* is distributed
   (e.g. `CC-BY-4.0`, `CC0-1.0`, or a bespoke commercial EULA).

## 2. Sellability rule

A `CorpusItem` is **sellable** only if:

- its `ConsentRecord` grants `commercial_use=True` **and** `redistribution=True`,
  and the consent has not been withdrawn and is within its retention window; and
- the corpus `License` permits commercial redistribution
  (`License.permits_commercial` is true).

`models.CorpusItem.is_sellable()` enforces exactly this. Items failing the rule
are still usable for internal/non-commercial research but are excluded from any
commercial export. The manifest records the reason.

## 3. Personal data & de-identification

Voice is biometric/personal data. The model separates:

- **Speaker** — stable pseudonymous `speaker_id`; demographic attributes are
  optional and stored separately from directly identifying information (which
  this backend never stores).
- **Prompts** must be screened so contributors are not induced to read PII.

De-identification status is tracked per item; commercial exports default to
pseudonymised manifests.

## 4. Auditability

Every accepted item stores a `Provenance` record (collector, consent id +
version, capture device/environment if known, pipeline version, timestamps).
A buyer can audit any clip back to the consent that authorised its sale.

> This document is engineering guidance for building a defensible system. It is
> **not legal advice** — have counsel review the consent wording and the EULA
> for each target jurisdiction before any sale.
