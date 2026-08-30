"""Generate synthetic baseline traffic, train the risk model, tune and emit artefacts.

Usage:
    python scripts/seed_baseline.py --out functions --users 500 --seed 42 --now 1735689600

Reproducibility
---------------
The artefacts (``model.joblib``, ``thresholds.json``) are a function of BOTH
``--seed`` and ``--now``: every synthetic window hangs off ``--now``, and the
hour-of-day features therefore move with it. Regenerating the committed pair
requires re-running with the *same* ``--seed`` and ``--now``. The committed
artefacts were produced with the exact command shown above
(``--now 1735689600`` = 2025-01-01T00:00:00Z).

Threshold tuning (spec 3.4)
---------------------------
After training, the script scores a fresh batch of NORMAL-only windows and a
fresh batch of each attack kind, then places the band thresholds against those
empirical distributions rather than shipping the ``Thresholds()`` defaults.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

from quantumsafe.ai.features import extract_features, features_to_vector  # noqa: E402
from quantumsafe.ai.model import RiskModel, train_model  # noqa: E402
from quantumsafe.ai.risk import BANDS, Thresholds, assess, band_for  # noqa: E402
from quantumsafe.ai.synthetic import (  # noqa: E402
    _IDLE_FRACTION,
    _TRAINING_SPAN_HOURS,
    build_training_matrix,
    generate_attack_events,
    generate_normal_events,
)

WINDOW_SECONDS = 300.0

ATTACK_KINDS = ("brute_force", "msg_flood", "off_hours_burst")
# The two kinds whose signature is loud enough that the spec expects a block.
HEADLINE_KINDS = ("brute_force", "msg_flood")

# Calibration batch sizes: large enough that a 1-in-100 tail is measurable.
CALIBRATION_NORMALS = 2000
CALIBRATION_ATTACKS = 400

# Floors keep a degenerate baseline (e.g. one that scores everything ~0) from
# collapsing the bands onto each other.
ELEVATED_FLOOR = 0.30
HIGH_FLOOR = 0.55
CRITICAL_TARGET = 0.80
# CRITICAL must stay clear of HIGH even when it has to be widened downwards.
CRITICAL_MARGIN = 0.05
# "Majority" for the headline attack kinds: the 40th percentile clears CRITICAL.
MAJORITY_PERCENTILE = 40
# Share of normal windows we are willing to see land HIGH (-> TERMINATE_SESSIONS).
FALSE_HIGH_BUDGET_PCT = 2.0
OFF_HOURS_UTC_END = 6


def _floor3(x: float) -> float:
    """Round down to 3 decimals -- rounding a threshold *up* can lose recall."""
    return math.floor(x * 1000.0) / 1000.0


def _budget_bound(normal: np.ndarray, budget_pct: float) -> float:
    """Lowest 3-dp threshold at which at most ``budget_pct`` of ``normal`` lands HIGH.

    Blended scores clump: every window whose model score saturates at 1.0 with
    no rule boost lands on exactly ``0.6``, so percentile placement can put the
    threshold *on* an atom and sweep the whole clump into HIGH. Taking the value
    just above the (k+1)-th largest normal score sidesteps that.
    """
    allowed = int(budget_pct / 100.0 * len(normal))
    descending = np.sort(normal)[::-1]
    if allowed >= len(descending):
        return 0.0
    return _floor3(float(descending[allowed])) + 0.001


def _score(model: RiskModel, events, now: float) -> float:
    """Blended risk score for one window. Independent of the thresholds."""
    feats = extract_features(events, now=now, window_seconds=WINDOW_SECONDS)
    return assess(feats, model.raw_score(features_to_vector(feats)), Thresholds()).score


def _normal_scores(rng, model: RiskModel, now: float, n: int) -> np.ndarray:
    """Score a fresh batch of NORMAL-only windows drawn like the training set."""
    out = []
    for i in range(n):
        window_now = now - float(rng.integers(0, _TRAINING_SPAN_HOURS)) * 3600.0
        events = (
            []
            if rng.random() < _IDLE_FRACTION
            else generate_normal_events(rng, f"cal-n{i}", window_now, WINDOW_SECONDS)
        )
        out.append(_score(model, events, window_now))
    return np.asarray(out)


def _attack_scores(rng, model: RiskModel, now: float, kind: str, n: int) -> np.ndarray:
    """Score a fresh batch of one attack kind, spread across the same span."""
    out = []
    for i in range(n):
        if kind == "off_hours_burst":
            # The name is only meaningful in the 00:00-06:00 UTC band that the
            # off-hours rule watches, so place these windows there deliberately.
            window_now = (
                now
                - float(rng.integers(0, _TRAINING_SPAN_HOURS // 24)) * 86400.0
                - float(rng.integers(0, OFF_HOURS_UTC_END)) * 3600.0
            )
        else:
            window_now = now - float(rng.integers(0, _TRAINING_SPAN_HOURS)) * 3600.0
        events = generate_attack_events(rng, f"cal-a{i}", window_now, WINDOW_SECONDS, kind=kind)
        out.append(_score(model, events, window_now))
    return np.asarray(out)


def tune_thresholds(
    normal: np.ndarray, attacks: dict[str, np.ndarray]
) -> tuple[Thresholds, list[str]]:
    """Place the band thresholds against the measured score distributions.

    - ``elevated`` sits at the 90th percentile of normal traffic, so roughly one
      normal window in ten is worth a second look.
    - ``high`` sits at the 99th percentile of normal traffic, pulled down to the
      weakest observed attack window so no attack kind is missed -- but never
      below the point where at most ``FALSE_HIGH_BUDGET_PCT`` of normal traffic
      lands HIGH. HIGH costs the user their sessions, so that budget is a hard
      constraint and recall is bought only within it. Never below ``HIGH_FLOOR``.
    - ``critical`` stays at ``CRITICAL_TARGET`` unless that would leave the
      headline attack kinds mostly sub-critical, in which case the CRITICAL band
      is widened downwards (with a warning) so a clear majority of them block.
      It never dips to where a normal window could reach it.
    """
    warnings: list[str] = []

    elevated = max(ELEVATED_FLOOR, float(np.percentile(normal, 90)))

    normal_p99 = _floor3(float(np.percentile(normal, 99)))
    weakest_attack = _floor3(min(float(scores.min()) for scores in attacks.values()))
    recall_first = max(HIGH_FLOOR, min(normal_p99, weakest_attack))
    budget_bound = _budget_bound(normal, FALSE_HIGH_BUDGET_PCT)
    high = max(recall_first, budget_bound)
    if budget_bound > recall_first:
        missed = {
            kind: 100.0 * float((scores < high).mean())
            for kind, scores in attacks.items()
            if (scores < high).any()
        }
        warnings.append(
            f"normal tail overlaps the weakest attack windows ({weakest_attack:.3f}): "
            f"placing `high` there would spend more than the "
            f"{FALSE_HIGH_BUDGET_PCT:.0f}% false-HIGH budget, so it was raised to "
            f"{high:.3f}; below-`high` share per kind: "
            + ", ".join(f"{k} {v:.1f}%" for k, v in sorted(missed.items()))
        )

    critical = CRITICAL_TARGET
    headline_floor = min(float(np.median(attacks[k])) for k in HEADLINE_KINDS)
    if headline_floor < CRITICAL_TARGET:
        widened = min(
            float(np.percentile(attacks[k], MAJORITY_PERCENTILE)) for k in HEADLINE_KINDS
        )
        critical = max(
            high + CRITICAL_MARGIN,
            float(normal.max()) + 0.01,  # keep normal traffic out of CRITICAL entirely
            min(CRITICAL_TARGET, _floor3(widened)),
        )
        warnings.append(
            f"headline attack medians peak at {headline_floor:.3f}, below the "
            f"{CRITICAL_TARGET:.2f} target; widened `critical` down to {critical:.3f}"
        )

    # Account-blocking must stay conservative: never let CRITICAL drop below 0.78,
    # whatever the tuner's data-driven expression produced above.
    critical = max(0.78, critical)

    thresholds = Thresholds(
        elevated=round(elevated, 3), high=round(high, 3), critical=round(critical, 3)
    )

    # Post-conditions the spec cares about; report rather than crash the seeding.
    for kind, scores in attacks.items():
        median = float(np.median(scores))
        if median < thresholds.high:
            warnings.append(f"{kind}: median {median:.3f} does not reach high {thresholds.high:.3f}")
    for kind in HEADLINE_KINDS:
        median = float(np.median(attacks[kind]))
        if median < thresholds.critical:
            warnings.append(
                f"{kind}: median {median:.3f} does not reach critical {thresholds.critical:.3f}"
            )
    return thresholds, warnings


def _band_share(scores: np.ndarray, thresholds: Thresholds) -> dict[str, float]:
    counts = dict.fromkeys(BANDS, 0)
    for score in scores:
        counts[band_for(float(score), thresholds)] += 1
    return {band: 100.0 * count / len(scores) for band, count in counts.items()}


def _fmt(share: dict[str, float]) -> str:
    return "  ".join(f"{band} {pct:5.1f}%" for band, pct in share.items())


def _check(label: str, ok: bool) -> None:
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--out", default="functions")
    parser.add_argument("--users", type=int, default=2000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--now",
        type=float,
        default=None,
        help=(
            "Epoch seconds the synthetic windows hang off. Defaults to the current "
            "wall clock; pass a fixed value to make the artefacts reproducible "
            "(the committed pair used --seed 42 --now 1735689600)."
        ),
    )
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    now = time.time() if args.now is None else args.now

    matrix = build_training_matrix(rng, args.users, now, WINDOW_SECONDS)
    model = train_model(matrix, random_state=args.seed)

    normal = _normal_scores(rng, model, now, CALIBRATION_NORMALS)
    attacks = {
        kind: _attack_scores(rng, model, now, kind, CALIBRATION_ATTACKS) for kind in ATTACK_KINDS
    }
    thresholds, warnings = tune_thresholds(normal, attacks)

    os.makedirs(args.out, exist_ok=True)
    model_path = os.path.join(args.out, "model.joblib")
    thr_path = os.path.join(args.out, "thresholds.json")
    model.save(model_path)
    with open(thr_path, "w", encoding="utf-8") as fh:
        json.dump(thresholds.to_dict(), fh, indent=2)
        fh.write("\n")

    quiet_score = _score(model, [], now)
    quiet_band = band_for(quiet_score, thresholds)
    normal_share = _band_share(normal, thresholds)
    attack_share = {kind: _band_share(scores, thresholds) for kind, scores in attacks.items()}

    print(f"wrote {model_path}")
    print(f"wrote {thr_path}")
    print(f"seed={args.seed} users={args.users} now={now!r}")
    print(f"tuned thresholds: {thresholds.to_dict()}")
    for warning in warnings:
        print(f"WARNING: {warning}")

    print(f"\nnormal-only ({CALIBRATION_NORMALS} windows)")
    print(f"  bands: {_fmt(normal_share)}")
    print(
        "  score p50=%.3f p90=%.3f p99=%.3f max=%.3f"
        % tuple(np.percentile(normal, [50, 90, 99, 100]))
    )
    print(f"\nattacks ({CALIBRATION_ATTACKS} windows per kind)")
    for kind in ATTACK_KINDS:
        scores = attacks[kind]
        print(
            f"  {kind:<16} min={scores.min():.3f} median={np.median(scores):.3f} "
            f"max={scores.max():.3f}"
        )
        print(f"  {'':<16} {_fmt(attack_share[kind])}")
    print(
        f"\nquiet (empty) window: score={quiet_score:.3f} band={quiet_band} "
        f"headroom below elevated={thresholds.elevated - quiet_score:.3f}"
    )

    print("\ntargets")
    _check(f"normal NORMAL >= 85% (got {normal_share['NORMAL']:.1f}%)", normal_share["NORMAL"] >= 85.0)
    _check(f"normal HIGH <= 2% (got {normal_share['HIGH']:.1f}%)", normal_share["HIGH"] <= 2.0)
    _check(
        f"normal CRITICAL == 0% (got {normal_share['CRITICAL']:.1f}%)",
        normal_share["CRITICAL"] == 0.0,
    )
    for kind in ATTACK_KINDS:
        reached = attack_share[kind]["HIGH"] + attack_share[kind]["CRITICAL"]
        _check(f"{kind}: 100% reach >= HIGH (got {reached:.1f}%)", reached == 100.0)
    for kind in HEADLINE_KINDS:
        share = attack_share[kind]["CRITICAL"]
        _check(f"{kind}: majority reach CRITICAL (got {share:.1f}%)", share > 50.0)
    _check(
        f"quiet window NORMAL with >= 0.05 headroom (got {thresholds.elevated - quiet_score:.3f})",
        quiet_band == "NORMAL" and thresholds.elevated - quiet_score >= 0.05,
    )


if __name__ == "__main__":
    main()
