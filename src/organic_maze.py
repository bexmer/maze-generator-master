"""Utilities for generating organic-looking mazes over random point sets.

This module exposes :func:`generate_organic_maze`, which builds a non-grid
maze by sampling random points, computing their Delaunay triangulation and
running a maze-carving algorithm (Prim or Kruskal) over the resulting graph.

The remaining, non-selected edges act as the maze walls.  Before returning,
each wall segment is jittered slightly so that renderers can display
hand-drawn looking strokes instead of perfectly straight lines.

Example
-------
>>> layout = generate_organic_maze(800, 600, base_point_count=180)
>>> layout.keys()
dict_keys(['width', 'height', 'walls'])

The caller can serialise ``layout`` to JSON and draw the segments directly in
SVG or Canvas.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import hypot, isclose
import random
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

Point = Tuple[float, float]
Edge = Tuple[int, int]


@dataclass(frozen=True)
class Triangle:
    """Triangle used during the Bowyer-Watson triangulation routine."""

    a: int
    b: int
    c: int
    cx: float
    cy: float
    radius_sq: float


def _circumcircle(points: Sequence[Point], a: int, b: int, c: int) -> Triangle:
    ax, ay = points[a]
    bx, by = points[b]
    cx, cy = points[c]

    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if isclose(d, 0.0):
        # Points are colinear; perturb slightly by taking the midpoint.
        mx = (ax + bx + cx) / 3.0
        my = (ay + by + cy) / 3.0
        r_sq = max(
            (ax - mx) ** 2 + (ay - my) ** 2,
            (bx - mx) ** 2 + (by - my) ** 2,
            (cx - mx) ** 2 + (cy - my) ** 2,
        )
        return Triangle(a, b, c, mx, my, r_sq)

    ax2_ay2 = ax * ax + ay * ay
    bx2_by2 = bx * bx + by * by
    cx2_cy2 = cx * cx + cy * cy

    ux = (
        ax2_ay2 * (by - cy)
        + bx2_by2 * (cy - ay)
        + cx2_cy2 * (ay - by)
    ) / d
    uy = (
        ax2_ay2 * (cx - bx)
        + bx2_by2 * (ax - cx)
        + cx2_cy2 * (bx - ax)
    ) / d

    r_sq = (ux - ax) ** 2 + (uy - ay) ** 2
    return Triangle(a, b, c, ux, uy, r_sq)


def _point_in_circumcircle(triangle: Triangle, point: Point) -> bool:
    px, py = point
    dx = triangle.cx - px
    dy = triangle.cy - py
    return dx * dx + dy * dy <= triangle.radius_sq


def _bowyer_watson(points: Sequence[Point]) -> List[Triangle]:
    """Compute the Delaunay triangulation for ``points``.

    Returns a list of :class:`Triangle` objects containing indices into
    ``points``.
    """

    if len(points) < 3:
        raise ValueError("At least three points are required for triangulation")

    xs, ys = zip(*points)
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    dx = max_x - min_x
    dy = max_y - min_y
    delta = max(dx, dy) * 10.0 or 1.0

    # Create a super triangle that encloses all points.
    mid_x = (min_x + max_x) / 2.0
    mid_y = (min_y + max_y) / 2.0
    super_pts = [
        (mid_x - 2 * delta, mid_y - delta),
        (mid_x, mid_y + 2 * delta),
        (mid_x + 2 * delta, mid_y - delta),
    ]

    extended_points = list(points) + super_pts
    super_indices = [len(points) + i for i in range(3)]

    triangles: List[Triangle] = [
        _circumcircle(extended_points, super_indices[0], super_indices[1], super_indices[2])
    ]

    for idx, point in enumerate(points):
        bad: List[Triangle] = []
        for tri in triangles:
            if _point_in_circumcircle(tri, point):
                bad.append(tri)

        polygon: Dict[Tuple[int, int], Tuple[int, int]] = {}
        for tri in bad:
            edges = [(tri.a, tri.b), (tri.b, tri.c), (tri.c, tri.a)]
            for a, b in edges:
                key = (min(a, b), max(a, b))
                if key in polygon:
                    del polygon[key]
                else:
                    polygon[key] = (a, b)

        for tri in bad:
            triangles.remove(tri)

        for (a, b) in polygon.values():
            new_tri = _circumcircle(extended_points, a, b, idx)
            triangles.append(new_tri)

    # Filter out triangles that share super triangle vertices.
    valid: List[Triangle] = []
    for tri in triangles:
        if any(v in super_indices for v in (tri.a, tri.b, tri.c)):
            continue
        valid.append(tri)

    return valid


def _extract_edges(triangles: Iterable[Triangle]) -> List[Edge]:
    edges: Dict[Tuple[int, int], None] = {}
    for tri in triangles:
        for a, b in ((tri.a, tri.b), (tri.b, tri.c), (tri.c, tri.a)):
            if a == b:
                continue
            edge = (a, b) if a < b else (b, a)
            edges.setdefault(edge, None)
    return list(edges.keys())


def _edge_weight(
    points: Sequence[Point],
    edge: Edge,
    zones: Optional[Sequence[Dict[str, float]]],
) -> float:
    (ax, ay), (bx, by) = points[edge[0]], points[edge[1]]
    weight = hypot(ax - bx, ay - by)
    if not zones:
        return weight

    mx = (ax + bx) / 2.0
    my = (ay + by) / 2.0
    for zone in zones:
        bias = zone.get("weight_bias")
        if bias is None:
            continue
        x0, y0, x1, y1 = zone["bounds"]
        if x0 <= mx <= x1 and y0 <= my <= y1:
            weight *= bias
    return weight


def _prim_mst(
    points: Sequence[Point],
    edges: Sequence[Edge],
    zones,
    rng: random.Random,
) -> List[Edge]:
    import heapq

    start = rng.randrange(len(points))

    visited = {start}
    heap: List[Tuple[float, int, Edge]] = []
    adjacency: Dict[int, List[int]] = {}
    for u, v in edges:
        adjacency.setdefault(u, []).append(v)
        adjacency.setdefault(v, []).append(u)

    counter = 0

    def push_edges(vertex: int) -> None:
        nonlocal counter
        for nxt in adjacency.get(vertex, []):
            if nxt in visited:
                continue
            edge = (vertex, nxt) if vertex < nxt else (nxt, vertex)
            weight = _edge_weight(points, edge, zones)
            counter += 1
            heapq.heappush(heap, (weight, counter, edge))

    push_edges(start)
    mst: List[Edge] = []

    while heap and len(visited) < len(points):
        _, _, edge = heapq.heappop(heap)
        u, v = edge
        if u in visited and v in visited:
            continue
        nxt = v if u in visited else u
        visited.add(nxt)
        mst.append(edge)
        push_edges(nxt)

    return mst


def _kruskal_mst(
    points: Sequence[Point],
    edges: Sequence[Edge],
    zones,
    rng: random.Random,
) -> List[Edge]:
    parent = list(range(len(points)))
    rank = [0] * len(points)

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> bool:
        root_a = find(a)
        root_b = find(b)
        if root_a == root_b:
            return False
        if rank[root_a] < rank[root_b]:
            parent[root_a] = root_b
        elif rank[root_a] > rank[root_b]:
            parent[root_b] = root_a
        else:
            parent[root_b] = root_a
            rank[root_a] += 1
        return True

    weighted_edges = [(_edge_weight(points, e, zones), rng.random(), e) for e in edges]
    weighted_edges.sort(key=lambda item: (item[0], item[1]))

    mst: List[Edge] = []
    for _, _, edge in weighted_edges:
        if union(edge[0], edge[1]):
            mst.append(edge)
        if len(mst) == len(points) - 1:
            break
    return mst


def _generate_points(
    width: float,
    height: float,
    base_point_count: int,
    zones: Optional[Sequence[Dict[str, float]]],
    rng: random.Random,
) -> Tuple[List[Point], List[Dict[str, float]]]:
    if base_point_count < 3:
        raise ValueError("base_point_count must be at least 3")

    total_area = width * height
    points: List[Point] = []

    for _ in range(base_point_count):
        points.append((rng.uniform(0, width), rng.uniform(0, height)))

    normalized_zones: List[Dict[str, float]] = []
    if zones:
        for zone in zones:
            x0, y0, x1, y1 = zone["bounds"]
            density_multiplier = max(zone.get("density_multiplier", 1.0), 0.0)
            density_points = int(zone.get("points", 0))
            if density_multiplier > 1.0:
                area = max((x1 - x0) * (y1 - y0), 0.0)
                expected = base_point_count * (area / total_area) * (density_multiplier - 1.0)
                density_points += int(expected)

            for _ in range(density_points):
                points.append((rng.uniform(x0, x1), rng.uniform(y0, y1)))

            normalized_zones.append(
                {
                    "bounds": (x0, y0, x1, y1),
                    "weight_bias": zone.get("weight_bias"),
                }
            )

    # Ensure the bounding box corners are part of the set to stabilise the mesh.
    points.extend([(0.0, 0.0), (width, 0.0), (0.0, height), (width, height)])

    # Deduplicate points by rounding to a small grid, then jitter slightly.
    unique = {}
    for x, y in points:
        key = (round(x, 4), round(y, 4))
        if key not in unique:
            unique[key] = (x, y)

    final_points = list(unique.values())
    return final_points, normalized_zones


def _jitter_segment(
    start: Point,
    end: Point,
    rng: random.Random,
    max_jitter: float,
    max_intermediate: int,
) -> Dict[str, object]:
    sx, sy = start
    ex, ey = end
    length = hypot(ex - sx, ey - sy)
    jitter_cap = min(max_jitter, length * 0.35)

    count = rng.randint(0, max_intermediate)
    intermediates = []
    if count and jitter_cap > 0:
        for _ in range(count):
            t = rng.uniform(0.2, 0.8)
            px = sx + (ex - sx) * t
            py = sy + (ey - sy) * t
            # Offset in a perpendicular direction.
            dx = ey - sy
            dy = -(ex - sx)
            norm = hypot(dx, dy) or 1.0
            scale = rng.uniform(-jitter_cap, jitter_cap) / norm
            px += dx * scale
            py += dy * scale
            intermediates.append({"x": px, "y": py})

    return {
        "start": {"x": sx, "y": sy},
        "end": {"x": ex, "y": ey},
        "points_intermediate": intermediates,
    }


def generate_organic_maze(
    width: int,
    height: int,
    base_point_count: int = 150,
    *,
    algorithm: str = "prim",
    zones: Optional[Sequence[Dict[str, float]]] = None,
    jitter: float = 6.0,
    max_intermediate_points: int = 2,
    seed: Optional[int] = None,
) -> Dict[str, object]:
    """Generate maze walls over a random Delaunay graph.

    Parameters
    ----------
    width, height:
        Size of the maze canvas.
    base_point_count:
        Number of random seed points to sample across the full area.
    algorithm:
        Either ``"prim"`` or ``"kruskal"`` selecting the maze carving
        algorithm.  Prim's algorithm is the default.
    zones:
        Optional iterable of dictionaries describing rectangular sub-areas.
        Each dictionary must provide ``bounds=(x0, y0, x1, y1)`` and may
        include ``density_multiplier`` (>= 0), ``points`` (int) and
        ``weight_bias`` (float).  The bias scales edge weights for edges whose
        midpoints fall inside the zone, influencing whether they become paths
        or remain walls.
    jitter:
        Maximum perpendicular displacement applied to the wall segments.
    max_intermediate_points:
        Upper bound on how many intermediate jitter points a wall may include.
    seed:
        Optional random seed for reproducibility.
    """

    rng = random.Random(seed)
    points, normalized_zones = _generate_points(width, height, base_point_count, zones, rng)

    triangles = _bowyer_watson(points)
    edges = _extract_edges(triangles)

    if algorithm.lower() == "prim":
        corridors = _prim_mst(points, edges, normalized_zones, rng)
    elif algorithm.lower() == "kruskal":
        corridors = _kruskal_mst(points, edges, normalized_zones, rng)
    else:
        raise ValueError("algorithm must be either 'prim' or 'kruskal'")

    corridor_set = {edge if edge[0] < edge[1] else (edge[1], edge[0]) for edge in corridors}
    walls: List[Dict[str, object]] = []

    rng.shuffle(edges)
    for edge in edges:
        ordered = edge if edge[0] < edge[1] else (edge[1], edge[0])
        if ordered in corridor_set:
            continue
        wall = _jitter_segment(points[ordered[0]], points[ordered[1]], rng, jitter, max_intermediate_points)
        walls.append(wall)

    # Add an irregular bounding rectangle so the maze stays enclosed.
    corners = [(0.0, 0.0), (width, 0.0), (width, height), (0.0, height)]
    for idx in range(4):
        start = corners[idx]
        end = corners[(idx + 1) % 4]
        wall = _jitter_segment(start, end, rng, jitter * 0.5, 1)
        walls.append(wall)

    return {"width": width, "height": height, "walls": walls}


if __name__ == "__main__":
    import json

    layout = generate_organic_maze(
        800,
        600,
        base_point_count=180,
        zones=[
            {
                "bounds": (100, 100, 350, 350),
                "density_multiplier": 1.6,
                "weight_bias": 0.75,
            },
            {
                "bounds": (450, 200, 750, 500),
                "points": 60,
                "weight_bias": 1.25,
            },
        ],
        seed=42,
    )
    print(json.dumps(layout, indent=2))
