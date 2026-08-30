"""Generate synthetic baseline traffic, train the risk model, emit artefacts.

Usage:
    python scripts/seed_baseline.py --out functions --users 2000 --seed 42
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

from quantumsafe.ai.features import extract_features, features_to_vector  # noqa: E402
from quantumsafe.ai.model import train_model  # noqa: E402
from quantumsafe.ai.risk import Thresholds, assess  # noqa: E402
from quantumsafe.ai.synthetic import (  # noqa: E402
    build_training_matrix,
    generate_attack_events,
    generate_normal_events,
)

WINDOW_SECONDS = 300.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="functions")
    parser.add_argument("--users", type=int, default=2000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    now = time.time()

    matrix = build_training_matrix(rng, args.users, now, WINDOW_SECONDS)
    model = train_model(matrix, random_state=args.seed)

    thresholds = Thresholds()
    os.makedirs(args.out, exist_ok=True)
    model_path = os.path.join(args.out, "model.joblib")
    thr_path = os.path.join(args.out, "thresholds.json")
    model.save(model_path)
    with open(thr_path, "w", encoding="utf-8") as fh:
        json.dump(thresholds.to_dict(), fh, indent=2)

    # quick report
    bands = {"NORMAL": 0, "ELEVATED": 0, "HIGH": 0, "CRITICAL": 0}
    for i in range(200):
        ev = generate_normal_events(rng, f"n{i}", now, WINDOW_SECONDS)
        f = extract_features(ev, now=now, window_seconds=WINDOW_SECONDS)
        bands[assess(f, model.raw_score(features_to_vector(f)), thresholds).band] += 1
    attack_hits = 0
    for i in range(60):
        kind = ("brute_force", "msg_flood", "off_hours_burst")[i % 3]
        ev = generate_attack_events(rng, f"a{i}", now, WINDOW_SECONDS, kind=kind)
        f = extract_features(ev, now=now, window_seconds=WINDOW_SECONDS)
        band = assess(f, model.raw_score(features_to_vector(f)), thresholds).band
        attack_hits += band in ("HIGH", "CRITICAL")

    print(f"wrote {model_path}")
    print(f"wrote {thr_path}")
    print(f"normal band distribution (200 samples): {bands}")
    print(f"attacks reaching HIGH/CRITICAL: {attack_hits}/60")


if __name__ == "__main__":
    main()
