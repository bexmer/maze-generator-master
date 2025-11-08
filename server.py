"""Flask server exposing the organic maze generator as a JSON API."""

from __future__ import annotations

from typing import Any, Dict, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

from src.organic_maze import generate_organic_maze

app = Flask(__name__)
CORS(app)


@app.route("/")
def index() -> Any:
    """Return a helpful message for the server root."""
    return jsonify({
        "service": "organic-maze",
        "message": "Use /generate-organic-maze with width, height, num_points, and other query parameters.",
    })


def _parse_float(name: str, default: Optional[float] = None) -> Optional[float]:
    value = request.args.get(name, type=str)
    if value is None or value == "":
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise ValueError(f"Parameter '{name}' must be a float") from exc


def _parse_int(name: str, default: Optional[int] = None) -> Optional[int]:
    value = request.args.get(name, type=str)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Parameter '{name}' must be an integer") from exc


@app.route("/generate-organic-maze")
def generate_organic_maze_route() -> Any:
    try:
        width = _parse_float("width", 800.0)
        height = _parse_float("height", 600.0)
        num_points = _parse_int("num_points", 200)
        jitter_magnitude = _parse_float("jitter_magnitude", 3.0)
        jitter_points = _parse_int("jitter_points", 1)
        seed = _parse_int("seed")

        if width is None or height is None or num_points is None:
            raise ValueError("'width', 'height', and 'num_points' parameters are required")

        algorithm = request.args.get("algorithm", "kruskal").lower()

        layout = generate_organic_maze(
            width=width,
            height=height,
            num_points=num_points,
            algorithm=algorithm,
            jitter_magnitude=jitter_magnitude if jitter_magnitude is not None else 3.0,
            jitter_points=jitter_points if jitter_points is not None else 1,
            seed=seed,
        )
        wall_count = len(layout.get("walls", [])) if isinstance(layout, dict) else "unknown"
        print(f"Laberinto generado. Total de paredes enviadas: {wall_count}")
        return jsonify(layout)
    except ValueError as error:
        print(f"Error al generar el laberinto: {error}")
        response: Dict[str, Any] = {"error": str(error)}
        return jsonify(response), 400
    except Exception as error:  # pragma: no cover - defensive logging
        print(f"Error inesperado al generar el laberinto: {error}")
        response: Dict[str, Any] = {"error": str(error)}
        return jsonify(response), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
