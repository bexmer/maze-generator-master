"""Organic, graph-based maze generator built on SciPy's Delaunay triangulation.

This module exposes :func:`generate_organic_maze` which builds a non-grid maze
by sampling random points inside a canvas, computing their Delaunay
triangulation and carving an organic spanning tree with either Prim's or
Kruskal's algorithm.  The remaining edges become the maze walls.

The resulting structure is easy to serialise to JSON so that JavaScript or
another renderer can draw the jittered wall segments with a hand-drawn look.
"""

from __future__ import annotations

from dataclasses import dataclass
from heapq import heappop, heappush
from math import hypot
import random
from typing import Dict, List, MutableMapping, Optional, Sequence, Tuple

import numpy as np
from scipy.spatial import Delaunay

Point = Tuple[float, float]
Edge = Tuple[int, int]


@dataclass(frozen=True)
class Wall:
    """Represents a jittered wall segment ready for JSON serialisation."""

    start: Point
    end: Point
    intermediates: Tuple[Point, ...]

    def as_mapping(self) -> Dict[str, object]:
        data: Dict[str, object] = {
            "start": {"x": self.start[0], "y": self.start[1]},
            "end": {"x": self.end[0], "y": self.end[1]},
        }
        if self.intermediates:
            data["points_intermediate"] = [
                {"x": x, "y": y} for (x, y) in self.intermediates
            ]
        return data


def _random_points(
    width: float,
    height: float,
    count: int,
    zones: Optional[Sequence[MutableMapping[str, object]]],
    rng: random.Random,
) -> List[Point]:
    """Sample ``count`` random points plus any optional zoned additions."""

    points: List[Point] = [
        (rng.uniform(0.0, width), rng.uniform(0.0, height)) for _ in range(count)
    ]

    if not zones:
        return points

    for zone in zones:
        bounds = zone.get("bounds")
        if not bounds:
            continue
        x0, y0, x1, y1 = bounds
        local_count = int(zone.get("point_count", 0))
        if local_count <= 0:
            continue
        for _ in range(local_count):
            points.append(
                (
                    rng.uniform(min(x0, x1), max(x0, x1)),
                    rng.uniform(min(y0, y1), max(y0, y1)),
                )
            )
    return points


def _collect_edges(triangulation: Delaunay) -> Dict[Edge, float]:
    """Extract the unique undirected edges with Euclidean weights."""

    simplices = triangulation.simplices
    pts = triangulation.points
    edges: Dict[Edge, float] = {}
    for simplex in simplices:
        for i in range(3):
            a = int(simplex[i])
            b = int(simplex[(i + 1) % 3])
            if a == b:
                continue
            edge = (a, b) if a < b else (b, a)
            if edge in edges:
                continue
            ax, ay = pts[edge[0]]
            bx, by = pts[edge[1]]
            edges[edge] = hypot(ax - bx, ay - by)
    return edges


class _UnionFind:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> bool:
        ra = self.find(a)
        rb = self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
        return True


def _kruskal(node_count: int, edges: Dict[Edge, float]) -> List[Edge]:
    sorted_edges = sorted(edges.items(), key=lambda item: item[1])
    uf = _UnionFind(node_count)
    tree: List[Edge] = []
    for (edge, weight) in sorted_edges:
        if uf.union(edge[0], edge[1]):
            tree.append(edge)
            if len(tree) == node_count - 1:
                break
    return tree


def _prim(
    node_count: int,
    adjacency: Dict[int, List[Tuple[float, int, int]]],
) -> List[Edge]:
    visited = [False] * node_count
    tree: List[Edge] = []
    pq: List[Tuple[float, int, int]] = []
    visited[0] = True
    for cost, _, v in adjacency[0]:
        heappush(pq, (cost, 0, v))
    while pq and len(tree) < node_count - 1:
        cost, u, v = heappop(pq)
        if visited[v]:
            continue
        visited[v] = True
        tree.append((min(u, v), max(u, v)))
        for next_cost, _, w in adjacency[v]:
            if not visited[w]:
                heappush(pq, (next_cost, v, w))
    return tree


def _build_adjacency(
    edges: Dict[Edge, float], node_count: int
) -> Dict[int, List[Tuple[float, int, int]]]:
    adjacency: Dict[int, List[Tuple[float, int, int]]] = {i: [] for i in range(node_count)}
    for (u, v), weight in edges.items():
        adjacency[u].append((weight, u, v))
        adjacency[v].append((weight, v, u))
    return adjacency


def _apply_zone_bias(
    edges: Dict[Edge, float],
    points: np.ndarray,
    zones: Optional[Sequence[MutableMapping[str, object]]],
) -> Dict[Edge, float]:
    if not zones:
        return edges

    adjusted: Dict[Edge, float] = dict(edges)
    for zone in zones:
        bounds = zone.get("bounds")
        if not bounds:
            continue
        bias = float(zone.get("weight_bias", 1.0))
        if bias <= 0:
            continue
        x0, y0, x1, y1 = bounds
        min_x, max_x = sorted((x0, x1))
        min_y, max_y = sorted((y0, y1))
        for edge, weight in edges.items():
            ax, ay = points[edge[0]]
            bx, by = points[edge[1]]
            mx = (ax + bx) / 2.0
            my = (ay + by) / 2.0
            if min_x <= mx <= max_x and min_y <= my <= max_y:
                adjusted[edge] = weight * bias
    return adjusted


def _jitter_segment(
    start: Point,
    end: Point,
    rng: random.Random,
    magnitude: float,
    extra_points: int,
) -> Tuple[Point, ...]:
    if magnitude <= 0 or extra_points <= 0:
        return ()
    intermediates: List[Point] = []
    for idx in range(1, extra_points + 1):
        t = idx / (extra_points + 1)
        mx = start[0] * (1 - t) + end[0] * t
        my = start[1] * (1 - t) + end[1] * t
        offset_x = rng.uniform(-magnitude, magnitude)
        offset_y = rng.uniform(-magnitude, magnitude)
        intermediates.append((mx + offset_x, my + offset_y))
    return tuple(intermediates)


def generate_organic_maze(
    width: float,
    height: float,
    num_points: int,
    *,
    algorithm: str = "kruskal",
    zones: Optional[Sequence[MutableMapping[str, object]]] = None,
    jitter_magnitude: float = 3.0,
    jitter_points: int = 1,
    seed: Optional[int] = None,
) -> Dict[str, object]:
    """Generate an organic maze layout over a Delaunay triangulation.

    Parameters
    ----------
    width, height:
        Dimensions of the canvas in which points are sampled.
    num_points:
        Number of base points to generate uniformly across the canvas.
    algorithm:
        Either ``"kruskal"`` or ``"prim"`` for the spanning-tree routine.
    zones:
        Optional sequence of mappings.  Each mapping may contain ``"bounds"``
        as ``(x0, y0, x1, y1)``, ``"point_count"`` for extra samples and
        ``"weight_bias"`` to scale edge weights that pass through the zone.
    jitter_magnitude:
        Maximum random offset applied to intermediate points of each wall.
    jitter_points:
        Number of random intermediate points added per wall segment.
    seed:
        Random seed for reproducible mazes.
    """

    if num_points < 3:
        raise ValueError("num_points must be at least 3 to form a triangulation")

    rng = random.Random(seed)
    base_points = _random_points(width, height, num_points, zones, rng)
    points = np.array(base_points)

    triangulation = Delaunay(points)
    raw_edges = _collect_edges(triangulation)
    biased_edges = _apply_zone_bias(raw_edges, points, zones)
    adjacency = _build_adjacency(biased_edges, len(points))

    if algorithm.lower() == "prim":
        mst_edges = _prim(len(points), adjacency)
    elif algorithm.lower() == "kruskal":
        mst_edges = _kruskal(len(points), biased_edges)
    else:
        raise ValueError("algorithm must be either 'prim' or 'kruskal'")

    mst_set = {edge for edge in mst_edges}

    walls: List[Dict[str, object]] = []
    for edge, weight in raw_edges.items():
        if edge in mst_set:
            continue
        start = tuple(points[edge[0]])
        end = tuple(points[edge[1]])
        intermediates = _jitter_segment(start, end, rng, jitter_magnitude, jitter_points)
        wall = Wall(start=start, end=end, intermediates=intermediates)
        walls.append(wall.as_mapping())

    return {"width": width, "height": height, "walls": walls}


if __name__ == "__main__":
    layout = generate_organic_maze(
        width=800,
        height=600,
        num_points=200,
        algorithm="kruskal",
        zones=[
            {
                "bounds": (100, 100, 300, 300),
                "point_count": 80,
                "weight_bias": 0.8,
            }
        ],
        jitter_magnitude=5.0,
        jitter_points=2,
        seed=1234,
    )
    import json

    print(json.dumps(layout, indent=2))
