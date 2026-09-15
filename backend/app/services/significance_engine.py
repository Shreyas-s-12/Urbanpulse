from typing import Any, Dict

class SignificanceEngine:
    """Evaluate the significance of a change.

    Returns a string severity level: "low", "medium", "high".
    This simple implementation uses static thresholds; you can extend it to
    use configurable thresholds from the database.
    """

    @staticmethod
    def evaluate_change(signal: str, previous: Any, current: Any, metadata: Dict[str, Any] = None) -> str:
        # Basic example for numeric signals
        try:
            delta = float(current) - float(previous)
        except Exception:
            # Non‑numeric or missing data → low significance
            return "low"

        # Thresholds can be refined per signal type
        if abs(delta) > 30:
            return "high"
        if abs(delta) > 10:
            return "medium"
        return "low"
