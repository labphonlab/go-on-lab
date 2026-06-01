"""Vowel formant (F1/F2) estimation via LPC — pure standard library.

Formant analysis is the gold standard of phonetic validation: if a corpus's
vowels land in the right places in F1/F2 space, the audio, the vowel labels and
the alignment are all jointly plausible. If they don't, something upstream is
wrong.

We estimate formants with classic LPC analysis, implemented with no third-party
dependency so it runs anywhere the rest of the core does:

  pre-emphasis -> Hamming window -> autocorrelation -> Levinson-Durbin (LPC)
  -> polynomial root finding (Durand-Kerner) -> formants from root angles.

This is the same method Praat and most phonetics toolkits use. Accuracy is
adequate for *corpus validation* (are the vowels roughly where they should be);
for publication-grade per-token measurement, cross-check against Praat.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def pre_emphasis(samples: list[float], coeff: float = 0.97) -> list[float]:
    if not samples:
        return []
    out = [samples[0]]
    for i in range(1, len(samples)):
        out.append(samples[i] - coeff * samples[i - 1])
    return out


def hamming(n: int) -> list[float]:
    if n <= 1:
        return [1.0] * max(n, 0)
    return [0.54 - 0.46 * math.cos(2 * math.pi * i / (n - 1)) for i in range(n)]


def autocorrelate(x: list[float], order: int) -> list[float]:
    """Autocorrelation r[0..order]."""
    n = len(x)
    r = [0.0] * (order + 1)
    for lag in range(order + 1):
        s = 0.0
        for i in range(lag, n):
            s += x[i] * x[i - lag]
        r[lag] = s
    return r


def levinson_durbin(r: list[float], order: int) -> list[float]:
    """Solve for LPC coefficients [1, a1, ..., a_order] from autocorrelation r."""
    a = [0.0] * (order + 1)
    a[0] = 1.0
    e = r[0]
    if e <= 0:
        return a
    for i in range(1, order + 1):
        acc = r[i]
        for j in range(1, i):
            acc += a[j] * r[i - j]
        k = -acc / e
        new_a = a[:]
        for j in range(1, i):
            new_a[j] = a[j] + k * a[i - j]
        new_a[i] = k
        a = new_a
        e *= (1 - k * k)
        if e <= 0:
            break
    return a


def _poly_roots_durand_kerner(coeffs: list[float], iters: int = 100,
                              tol: float = 1e-9) -> list[complex]:
    """Roots of a polynomial (highest-degree coeff first) via Durand-Kerner.

    ``coeffs`` are real. Returns complex roots. Robust enough for LPC
    polynomials (order ~10-20).
    """
    # Normalise to monic and drop leading zeros.
    c = list(coeffs)
    while len(c) > 1 and abs(c[0]) < 1e-15:
        c.pop(0)
    n = len(c) - 1
    if n < 1:
        return []
    c = [x / c[0] for x in c]

    # Initial guesses: spread around the unit circle (classic 0.4+0.9j seed).
    seed = complex(0.4, 0.9)
    roots = [seed ** k for k in range(n)]

    def evalp(z: complex) -> complex:
        v = 0j
        for coef in c:
            v = v * z + coef
        return v

    for _ in range(iters):
        max_delta = 0.0
        for i in range(n):
            num = evalp(roots[i])
            den = 1 + 0j
            for j in range(n):
                if j != i:
                    den *= (roots[i] - roots[j])
            if abs(den) < 1e-300:
                continue
            delta = num / den
            roots[i] -= delta
            max_delta = max(max_delta, abs(delta))
        if max_delta < tol:
            break
    return roots


@dataclass
class Formants:
    f1: float | None
    f2: float | None
    f3: float | None
    all_hz: list

    def as_dict(self) -> dict:
        r = lambda x: None if x is None else round(x, 1)  # noqa: E731
        return {"f1": r(self.f1), "f2": r(self.f2), "f3": r(self.f3)}


def lpc_order_for(sample_rate: int, max_hz: float = 5000.0) -> int:
    """LPC order = 2 poles per expected formant + 2 (for the spectral slope).

    The number of formants expected below ``max_hz`` is ~max_hz/1000, so on a
    signal already downsampled to ~2*max_hz this gives a tight order (~10 for a
    5 kHz ceiling) that resists the over-fitting which invents spurious poles.
    """
    n_formants = max(1, int(round(max_hz / 1000)))
    return 2 * n_formants


def _lowpass_fir(samples: list[float], cutoff_hz: float, sample_rate: int,
                 taps: int = 31) -> list[float]:
    """Windowed-sinc low-pass — anti-aliasing before decimation."""
    if not samples:
        return []
    fc = cutoff_hz / sample_rate           # normalised cutoff (0..0.5)
    m = taps - 1
    h = []
    for i in range(taps):
        x = i - m / 2
        # sinc
        sinc = 2 * fc if x == 0 else math.sin(2 * math.pi * fc * x) / (math.pi * x)
        ham = 0.54 - 0.46 * math.cos(2 * math.pi * i / m)  # Hamming window
        h.append(sinc * ham)
    s = sum(h)
    h = [c / s for c in h]                 # unity DC gain
    # Convolve (same length, zero-padded edges).
    n = len(samples)
    out = [0.0] * n
    half = taps // 2
    for i in range(n):
        acc = 0.0
        for k in range(taps):
            j = i + k - half
            if 0 <= j < n:
                acc += samples[j] * h[k]
        out[i] = acc
    return out


def resample_linear(samples: list[float], src_sr: int, dst_sr: int) -> list[float]:
    """Anti-aliased downsample toward 2x the formant ceiling, so the LPC order
    isn't wasted modelling (and aliasing) an empty high-frequency band — the same
    preparation Praat does before formant analysis. Low-passes at the new Nyquist
    first, then linearly interpolates."""
    if dst_sr >= src_sr or not samples:
        return list(samples)
    filtered = _lowpass_fir(samples, 0.45 * dst_sr, src_sr)
    ratio = src_sr / dst_sr
    n_out = int(len(filtered) / ratio)
    out = [0.0] * n_out
    for i in range(n_out):
        pos = i * ratio
        lo = int(pos)
        frac = pos - lo
        hi = min(lo + 1, len(filtered) - 1)
        out[i] = filtered[lo] * (1 - frac) + filtered[hi] * frac
    return out


def estimate_formants(samples: list[float], sample_rate: int,
                      order: int | None = None,
                      min_hz: float = 90.0, max_hz: float = 5000.0,
                      max_bandwidth_hz: float = 400.0) -> Formants:
    """Estimate formants from a (short, vowel-centred) sample window.

    The signal is downsampled to ~2*max_hz before LPC so the model order is
    spent on the formant band, not the empty top octave (this is what makes the
    estimate stable; see module docstring).
    """
    if len(samples) < 16:
        return Formants(None, None, None, [])

    # Downsample toward the formant ceiling and size the order to the new rate.
    target_sr = int(2 * max_hz)
    if sample_rate > target_sr:
        samples = resample_linear(samples, sample_rate, target_sr)
        sample_rate = target_sr
        if len(samples) < 16:
            return Formants(None, None, None, [])
    order = order or lpc_order_for(sample_rate, max_hz)

    x = pre_emphasis(samples)
    win = hamming(len(x))
    x = [xi * wi for xi, wi in zip(x, win)]

    r = autocorrelate(x, order)
    if r[0] <= 0:
        return Formants(None, None, None, [])
    a = levinson_durbin(r, order)

    roots = _poly_roots_durand_kerner(a)
    cand: list[tuple[float, float]] = []  # (freq, bandwidth)
    for z in roots:
        if z.imag <= 0:                  # take one of each conjugate pair
            continue
        freq = math.atan2(z.imag, z.real) * sample_rate / (2 * math.pi)
        mag = abs(z)
        if mag <= 0 or mag >= 1.0:       # unstable / outside unit circle
            continue
        bw = -0.5 * (sample_rate / (2 * math.pi)) * math.log(mag)
        if min_hz <= freq <= max_hz and bw < max_bandwidth_hz:
            cand.append((freq, bw))

    freqs = sorted(f for f, _ in cand)
    f1 = freqs[0] if len(freqs) > 0 else None
    f2 = freqs[1] if len(freqs) > 1 else None
    f3 = freqs[2] if len(freqs) > 2 else None
    return Formants(f1, f2, f3, freqs)


def window_for_interval(samples: list[float], sample_rate: int,
                        start_s: float, end_s: float,
                        center_fraction: float = 0.5,
                        window_s: float = 0.025) -> list[float]:
    """Extract a short analysis window centred in a phone interval.

    Sampling the steady-state middle of the vowel avoids the coarticulated
    edges — standard practice for formant measurement.
    """
    dur = end_s - start_s
    if dur <= 0:
        return []
    center = start_s + dur * center_fraction
    half = window_s / 2
    a = max(0, int((center - half) * sample_rate))
    b = min(len(samples), int((center + half) * sample_rate))
    return samples[a:b]
