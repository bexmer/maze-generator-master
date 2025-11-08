"""Sinuous maze generator built on a recursive backtracker grid core.

This module provides utilities to generate an organic-looking maze made of
curvilinear corridors suitable for free-form rendering on a canvas. The
workflow is split into four major steps that mirror the user requirements:

1.  Build a classical grid maze using the recursive backtracker algorithm.
2.  Create a 2D flow field from OpenSimplex noise that assigns a bearing to
    each traversable cell of the maze.
3.  Trace continuous paths through the flow field while staying inside the
    carved corridors, producing smooth polylines for each passage.
4.  Package the traced paths into a JSON-ready mapping along with canvas
    dimensions so that front-ends can render the result directly.

The primary entry point is :func:`generate_sinuous_maze`.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from opensimplex import OpenSimplex


Grid = List[List[int]]
AngleField = List[List[float]]


@dataclass
class PathPoint:
    """Simple data holder for a 2D point."""

    x: float
    y: float

    def to_mapping(self) -> Dict[str, float]:
        return {"x": self.x, "y": self.y}


def generate_grid_maze(width: int, height: int, *, rng: Optional[random.Random] = None) -> Grid:
    """Create a binary maze grid using the recursive backtracker algorithm.

    Parameters
    ----------
    width, height:
        Maze dimensions measured in cells (not including surrounding walls).
    rng:
        Optional random number generator. When omitted a new ``Random`` instance
        seeded from system entropy is used.

    Returns
    -------
    List[List[int]]
        A matrix whose shape is ``(2 * height + 1, 2 * width + 1)`` where ``0``
        values represent corridors and ``1`` values represent walls.
    """

    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive integers")

    rand = rng or random.Random()

    grid_width = 2 * width + 1
    grid_height = 2 * height + 1

    grid: Grid = [[1 for _ in range(grid_width)] for _ in range(grid_height)]

    start_cell = (0, 0)
    stack: List[Tuple[int, int]] = [start_cell]
    visited = {start_cell}

    def cell_to_grid(cx: int, cy: int) -> Tuple[int, int]:
        return 2 * cy + 1, 2 * cx + 1

    # carve the starting cell
    sy, sx = cell_to_grid(*start_cell)
    grid[sy][sx] = 0

    while stack:
        cx, cy = stack[-1]
        neighbors: List[Tuple[int, int, int, int]] = []
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                neighbors.append((nx, ny, dx, dy))

        if not neighbors:
            stack.pop()
            continue

        nx, ny, dx, dy = rand.choice(neighbors)
        visited.add((nx, ny))

        # carve passage between current cell and neighbor
        gy, gx = cell_to_grid(cx, cy)
        wall_y = gy + dy
        wall_x = gx + dx
        ngy, ngx = cell_to_grid(nx, ny)

        grid[wall_y][wall_x] = 0
        grid[ngy][ngx] = 0

        stack.append((nx, ny))

    return grid


def generate_flow_field(
    rows: int,
    cols: int,
    noise_scale: float,
    *,
    seed: Optional[int] = None,
) -> AngleField:
    """Generate a 2D array of angles using OpenSimplex noise."""

    if noise_scale <= 0:
        raise ValueError("noise_scale must be a positive number")

    simplex = OpenSimplex(seed=0 if seed is None else seed)
    field: AngleField = [[0.0 for _ in range(cols)] for _ in range(rows)]

    for y in range(rows):
        for x in range(cols):
            nx = x / noise_scale
            ny = y / noise_scale
            noise_val = simplex.noise2(nx, ny)  # range [-1, 1]
            # Map noise to [0, 2π)
            angle = (noise_val + 1.0) * math.pi
            field[y][x] = angle

    return field


def trace_sinuous_paths(
    grid: Grid,
    flow_field: AngleField,
    canvas_width: float,
    canvas_height: float,
    *,
    step_size: float = 0.45,
    max_steps_per_path: int = 4000,
) -> List[List[Dict[str, float]]]:
    """Convert the maze grid into jittered polylines using the flow field."""

    rows = len(grid)
    if rows == 0:
        return []
    cols = len(grid[0])

    scale_x = canvas_width / cols
    scale_y = canvas_height / rows

    visit_counts = [[0 for _ in range(cols)] for _ in range(rows)]
    consumed = [[False for _ in range(cols)] for _ in range(rows)]

    paths: List[List[Dict[str, float]]] = []

    for row in range(rows):
        for col in range(cols):
            if grid[row][col] != 0 or consumed[row][col]:
                continue

            cx = col + 0.5
            cy = row + 0.5
            steps = 0
            path: List[PathPoint] = []

            while steps < max_steps_per_path:
                if not (0 <= cx < cols and 0 <= cy < rows):
                    break

                grid_y = int(cy)
                grid_x = int(cx)

                if grid[grid_y][grid_x] == 1:
                    break

                visit_counts[grid_y][grid_x] += 1
                if visit_counts[grid_y][grid_x] > 2:
                    break

                consumed[grid_y][grid_x] = True

                canvas_point = PathPoint(x=cx * scale_x, y=cy * scale_y)
                if not path or path[-1] != canvas_point:
                    path.append(canvas_point)

                angle = flow_field[grid_y][grid_x]
                cx += math.cos(angle) * step_size
                cy += math.sin(angle) * step_size

                steps += 1

            if len(path) >= 2:
                paths.append([pt.to_mapping() for pt in path])

    return paths


def generate_sinuous_maze(
    grid_width: int,
    grid_height: int,
    canvas_width: float,
    canvas_height: float,
    noise_scale: float,
    *,
    seed: Optional[int] = None,
) -> Dict[str, object]:
    """Generate an organic maze as a JSON-friendly mapping.

    Parameters
    ----------
    grid_width, grid_height:
        Dimensions of the base recursive-backtracker maze in cells.
    canvas_width, canvas_height:
        Physical size of the drawing surface that will render the maze.
    noise_scale:
        Controls the frequency of the OpenSimplex flow field; larger values
        produce gentler curves while smaller values yield tighter bends.
    seed:
        Optional deterministic seed applied to both the maze generator and the
        noise field. When omitted a random seed is used.
    """

    base_rng = random.Random(seed)

    grid = generate_grid_maze(grid_width, grid_height, rng=base_rng)

    noise_seed = base_rng.randint(0, 2**31 - 1)
    flow_field = generate_flow_field(len(grid), len(grid[0]), noise_scale, seed=noise_seed)

    paths = trace_sinuous_paths(grid, flow_field, canvas_width, canvas_height)

    return {
        "canvas_width": canvas_width,
        "canvas_height": canvas_height,
        "grid_width": grid_width,
        "grid_height": grid_height,
        "paths": paths,
    }


def _demo() -> None:
    """Run a simple demonstration and print JSON-like output."""

    result = generate_sinuous_maze(
        grid_width=20,
        grid_height=20,
        canvas_width=800,
        canvas_height=600,
        noise_scale=12.0,
        seed=42,
    )

    print(
        f"Generated maze with {len(result['paths'])} paths on a"
        f" {result['canvas_width']}x{result['canvas_height']} canvas"
    )


if __name__ == "__main__":
    _demo()

