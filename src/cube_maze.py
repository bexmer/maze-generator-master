# -*- coding: utf-8 -*-
"""Generador de laberintos interconectados en la superficie de un cubo.

La función principal ``generar_laberintos_conectados`` construye un único grafo
que aglutina las seis caras del cubo (superior, frontal, derecha, posterior,
izquierda e inferior) y ejecuta un algoritmo de "recursive backtracker" sobre
dicho grafo. El resultado se entrega como un diccionario que asocia el nombre
de cada cara con una cuadrícula ``tamaño_grid x tamaño_grid`` cuyos valores son
máscaras de bits con los pasillos abiertos desde cada celda en las direcciones
``N`` (1), ``E`` (2), ``S`` (4) y ``W`` (8).
"""

from __future__ import annotations

import random
from typing import Callable, Dict, Iterable, List, Sequence, Tuple

# Representación de caras siguiendo la convención habitual del cubo.
SUPERIOR, FRONTAL, DERECHA, POSTERIOR, IZQUIERDA, INFERIOR = range(6)
FACE_NAMES = [
    "superior",
    "frontal",
    "derecha",
    "posterior",
    "izquierda",
    "inferior",
]

DIRECTIONS: Sequence[str] = ("N", "E", "S", "W")
OFFSETS: Dict[str, Tuple[int, int]] = {
    "N": (-1, 0),
    "E": (0, 1),
    "S": (1, 0),
    "W": (0, -1),
}
OPPOSITE: Dict[str, str] = {"N": "S", "S": "N", "E": "W", "W": "E"}
DIR_MASKS: Dict[str, int] = {"N": 1, "E": 2, "S": 4, "W": 8}

# Cada entrada describe cómo se conecta un borde de una cara concreta con otra
# cara del cubo y qué borde de la cara destino participa en la conexión. Las
# funciones de transformación reciben la posición (fila, columna) dentro de la
# cara de origen (que siempre estará en el borde correspondiente) y devuelven
# la coordenada dentro de la cara destino donde debe aterrizar el portal.
Transform = Callable[[int, int, int], Tuple[int, int]]
EdgeMapping = Dict[str, Tuple[int, str, Transform]]

EDGE_CONNECTIONS: Dict[int, EdgeMapping] = {
    SUPERIOR: {
        "N": (POSTERIOR, "N", lambda r, c, size: (0, size - 1 - c)),
        "E": (DERECHA, "N", lambda r, c, size: (0, size - 1 - r)),
        "S": (FRONTAL, "N", lambda r, c, size: (0, c)),
        "W": (IZQUIERDA, "N", lambda r, c, size: (0, r)),
    },
    FRONTAL: {
        "N": (SUPERIOR, "S", lambda r, c, size: (size - 1, c)),
        "E": (DERECHA, "W", lambda r, c, size: (r, 0)),
        "S": (INFERIOR, "N", lambda r, c, size: (0, c)),
        "W": (IZQUIERDA, "E", lambda r, c, size: (r, size - 1)),
    },
    DERECHA: {
        "N": (SUPERIOR, "E", lambda r, c, size: (size - 1 - c, size - 1)),
        "E": (POSTERIOR, "W", lambda r, c, size: (r, 0)),
        "S": (INFERIOR, "E", lambda r, c, size: (c, size - 1)),
        "W": (FRONTAL, "E", lambda r, c, size: (r, size - 1)),
    },
    POSTERIOR: {
        "N": (SUPERIOR, "N", lambda r, c, size: (0, size - 1 - c)),
        "E": (IZQUIERDA, "W", lambda r, c, size: (r, 0)),
        "S": (INFERIOR, "S", lambda r, c, size: (size - 1, size - 1 - c)),
        "W": (DERECHA, "E", lambda r, c, size: (r, size - 1)),
    },
    IZQUIERDA: {
        "N": (SUPERIOR, "W", lambda r, c, size: (c, 0)),
        "E": (FRONTAL, "W", lambda r, c, size: (r, 0)),
        "S": (INFERIOR, "W", lambda r, c, size: (size - 1 - c, 0)),
        "W": (POSTERIOR, "E", lambda r, c, size: (r, size - 1)),
    },
    INFERIOR: {
        "N": (FRONTAL, "S", lambda r, c, size: (size - 1, c)),
        "E": (DERECHA, "S", lambda r, c, size: (size - 1, r)),
        "S": (POSTERIOR, "S", lambda r, c, size: (size - 1, size - 1 - c)),
        "W": (IZQUIERDA, "S", lambda r, c, size: (size - 1, size - 1 - r)),
    },
}


def _iter_neighbors(
    face: int, row: int, col: int, size: int
) -> Iterable[Tuple[Tuple[int, int, int], str, str]]:
    """Devuelve vecinos con la dirección local y la dirección remota.

    Cada vecino queda representado como ``((cara, fila, columna), d_actual,
    d_remota)``, donde ``d_actual`` es la pared del nodo actual que se abriría y
    ``d_remota`` es la pared equivalente en el nodo vecino.
    """

    for direction in DIRECTIONS:
        dr, dc = OFFSETS[direction]
        nr, nc = row + dr, col + dc
        if 0 <= nr < size and 0 <= nc < size:
            yield (face, nr, nc), direction, OPPOSITE[direction]
        else:
            neighbor_face, neighbor_dir, transform = EDGE_CONNECTIONS[face][direction]
            nr, nc = transform(row, col, size)
            yield (neighbor_face, nr, nc), direction, neighbor_dir


def _build_global_graph(size: int) -> Dict[Tuple[int, int, int], List[Tuple[Tuple[int, int, int], str, str]]]:
    """Construye el grafo unificado con todas las celdas del cubo."""

    graph: Dict[Tuple[int, int, int], List[Tuple[Tuple[int, int, int], str, str]]] = {}
    for face in range(6):
        for row in range(size):
            for col in range(size):
                node = (face, row, col)
                graph[node] = list(_iter_neighbors(face, row, col, size))
    return graph


def generar_laberintos_conectados(
    num_caras: int, tamaño_grid: int
) -> Dict[str, List[List[int]]]:
    """Genera ``num_caras`` laberintos enlazados como las caras de un cubo.

    Args:
        num_caras: Número de caras a generar; solo se admite el valor 6.
        tamaño_grid: Número de celdas por lado de cada cara (>= 2).

    Returns:
        Diccionario que asocia el nombre de cada cara (superior, frontal,
        derecha, posterior, izquierda, inferior) con una matriz de tamaño
        ``tamaño_grid x tamaño_grid``. Cada entrada de la matriz es una máscara
        de bits que indica qué pasillos permanecen abiertos desde esa celda
        (``N`` -> 1, ``E`` -> 2, ``S`` -> 4, ``W`` -> 8).

    Raises:
        ValueError: Si ``num_caras`` no es 6 o ``tamaño_grid`` es menor que 2.
    """

    if num_caras != 6:
        raise ValueError("Solo es posible crear laberintos conectados para un cubo (6 caras).")
    if tamaño_grid < 2:
        raise ValueError("El tamaño de la cuadrícula debe ser al menos 2x2.")

    graph = _build_global_graph(tamaño_grid)
    laberintos = [
        [[0 for _ in range(tamaño_grid)] for _ in range(tamaño_grid)] for _ in range(num_caras)
    ]

    rng = random.Random()
    start = (SUPERIOR, 0, 0)
    visitados = {start}
    pila = [start]

    while pila:
        actual = pila[-1]
        face, row, col = actual
        candidatos = [
            vecino for vecino in graph[actual] if vecino[0] not in visitados
        ]
        if candidatos:
            siguiente, dir_actual, dir_remota = rng.choice(candidatos)
            n_face, n_row, n_col = siguiente
            laberintos[face][row][col] |= DIR_MASKS[dir_actual]
            laberintos[n_face][n_row][n_col] |= DIR_MASKS[dir_remota]
            visitados.add(siguiente)
            pila.append(siguiente)
        else:
            pila.pop()

    return {FACE_NAMES[face]: laberintos[face] for face in range(num_caras)}


def describir_mapa_de_bordes() -> Dict[str, Dict[str, str]]:
    """Devuelve el mapa de adyacencia de caras en formato legible."""

    nombres_por_cara = dict(enumerate(FACE_NAMES))
    resultado: Dict[str, Dict[str, str]] = {}
    for face, edges in EDGE_CONNECTIONS.items():
        face_name = nombres_por_cara[face]
        resultado[face_name] = {}
        for direction, (neighbor_face, neighbor_dir, _transform) in edges.items():
            resultado[face_name][direction] = f"{nombres_por_cara[neighbor_face]} ({neighbor_dir})"
    return resultado


__all__ = [
    "generar_laberintos_conectados",
    "describir_mapa_de_bordes",
]
