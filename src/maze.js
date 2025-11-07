function Maze(args) {
  const defaults = {
    width: 20,
    height: 20,
    wallSize: 1,
    passageSize: 1,
    entryType: "",
    bias: "",
    color: "#fb0000ff",
    backgroundColor: "#000000ff",
    solveColor: "#3748ccff",
    removeWalls: 0,

    // Maximum 300 walls can be removed
    maxWallsRemove: 300,

    // No restrictions
    maxMaze: 0,
    maxCanvas: 0,
    maxCanvasDimension: 0,
    maxSolve: 0,
  };

  const settings = Object.assign({}, defaults, args);

  this.matrix = [];
  this.wallsRemoved = 0;
  this.width = parseInt(settings["width"], 10);
  this.height = parseInt(settings["height"], 10);
  const parsedWallSize = parseInt(settings["wallSize"], 10);
  const parsedPassageSize = parseInt(settings["passageSize"], 10);
  this.wallThickness = Math.max(1, isNaN(parsedWallSize) ? 1 : parsedWallSize);
  this.passageSize = Math.max(1, isNaN(parsedPassageSize) ? 1 : parsedPassageSize);
  this.wallSize = this.wallThickness;
  this.removeWalls = parseInt(settings["removeWalls"], 10);
  this.randomizeWalls = !!settings["randomizeWalls"];
  const parsedWallRandomMin = parseInt(settings["wallRandomMin"], 10);
  const parsedWallRandomMax = parseInt(settings["wallRandomMax"], 10);
  let wallRandomMin = Math.max(1, isNaN(parsedWallRandomMin) ? this.wallThickness : parsedWallRandomMin);
  let wallRandomMax = Math.max(
    wallRandomMin,
    isNaN(parsedWallRandomMax) ? wallRandomMin : parsedWallRandomMax
  );
  if (!this.randomizeWalls) {
    wallRandomMin = this.wallThickness;
    wallRandomMax = this.wallThickness;
  }
  this.wallRandomMin = wallRandomMin;
  this.wallRandomMax = wallRandomMax;
  this.hideOuterBorder = !!settings["removeOuterBorder"];
  const parsedExtraExits = parseInt(settings["extraExits"], 10);
  this.extraExitCount = Math.max(0, isNaN(parsedExtraExits) ? 0 : parsedExtraExits);
  const entryConfig = this.getEntryNodes(settings["entryType"]);
  this.entryNodes = entryConfig.nodes;
  this.extraGates = Array.isArray(entryConfig.extraGates)
    ? entryConfig.extraGates.slice()
    : [];
  this.usedGateSet = entryConfig.usedGateKeys instanceof Set
    ? new Set(entryConfig.usedGateKeys)
    : new Set(entryConfig.usedGateKeys || []);
  this.addExtraExits(this.extraExitCount);
  this.bias = settings["bias"];
  this.color = settings["color"];
  this.backgroundColor = settings["backgroundColor"];
  this.solveColor = settings["solveColor"];
  this.maxMaze = parseInt(settings["maxMaze"], 1);
  this.maxCanvas = parseInt(settings["maxCanvas"], 10);
  this.maxCanvasDimension = parseInt(settings["maxCanvasDimension"], 10);
  this.maxSolve = parseInt(settings["maxSolve"], 1);
  this.maxWallsRemove = parseInt(settings["maxWallsRemove"], 10);
  this.layoutCache = null;
  const allowedWallStyles = new Set(["grid", "curved", "angled", "organic"]);
  const requestedStyle = typeof settings["wallStyle"] === "string"
    ? settings["wallStyle"].toLowerCase()
    : "grid";
  this.wallStyle = allowedWallStyles.has(requestedStyle) ? requestedStyle : "grid";
  const parsedVariance = parseInt(settings["wallShapeVariance"], 10);
  const clampedVariance = Math.min(100, Math.max(0, isNaN(parsedVariance) ? 0 : parsedVariance));
  this.wallShapeVariance = clampedVariance / 100;
  this.wallShapeCache = new Map();
  this.organicEdgeCache = new Map();
  this.organicNodeCache = new Map();
}

Maze.prototype.generate = function () {
  if (!this.isValidSize()) {
    this.matrix = [];
    alert("Please use smaller maze dimensions");
    return;
  }

  let nodes = this.generateNodes();
  nodes = this.parseMaze(nodes);
  this.getMatrix(nodes);
  this.removeMazeWalls();
};

Maze.prototype.isValidSize = function () {
  const max = this.maxCanvasDimension;
  const canvas = this.getCanvasSize();

  // Max dimension Firefox and Chrome
  if (max && (max <= canvas.width || max <= canvas.height)) {
    return false;
  }

  // Max area (200 columns) * (200 rows) with wall size 10px
  if (this.maxCanvas && this.maxCanvas <= canvas.width * canvas.height) {
    return false;
  }

  return true;
};

Maze.prototype.computeLayout = function () {
  const columns = this.width * 2 + 1;
  const rows = this.height * 2 + 1;

  const columnWidths = new Array(columns);
  const columnStarts = new Array(columns);
  let columnOffset = 0;

  const randomIntInRange = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const verticalWallThicknesses = new Array(this.width + 1);
  const horizontalWallThicknesses = new Array(this.height + 1);

  for (let i = 0; i < verticalWallThicknesses.length; i++) {
    verticalWallThicknesses[i] = this.randomizeWalls
      ? randomIntInRange(this.wallRandomMin, this.wallRandomMax)
      : this.wallThickness;
  }

  for (let i = 0; i < horizontalWallThicknesses.length; i++) {
    horizontalWallThicknesses[i] = this.randomizeWalls
      ? randomIntInRange(this.wallRandomMin, this.wallRandomMax)
      : this.wallThickness;
  }

  for (let i = 0; i < columns; i++) {
    columnStarts[i] = columnOffset;
    const width = i % 2 === 0
      ? verticalWallThicknesses[i / 2]
      : this.passageSize;
    columnWidths[i] = width;
    columnOffset += width;
  }

  const rowHeights = new Array(rows);
  const rowStarts = new Array(rows);
  let rowOffset = 0;

  for (let i = 0; i < rows; i++) {
    rowStarts[i] = rowOffset;
    const height = i % 2 === 0
      ? horizontalWallThicknesses[i / 2]
      : this.passageSize;
    rowHeights[i] = height;
    rowOffset += height;
  }

  return {
    columnWidths,
    columnStarts,
    rowHeights,
    rowStarts,
    canvasWidth: columnOffset,
    canvasHeight: rowOffset,
    width: this.width,
    height: this.height,
    wallThickness: this.wallThickness,
    passageSize: this.passageSize,
    randomizeWalls: this.randomizeWalls,
    wallRandomMin: this.wallRandomMin,
    wallRandomMax: this.wallRandomMax,
  };
};

Maze.prototype.getLayout = function () {
  if (
    !this.layoutCache ||
    this.layoutCache.width !== this.width ||
    this.layoutCache.height !== this.height ||
    this.layoutCache.wallThickness !== this.wallThickness ||
    this.layoutCache.passageSize !== this.passageSize ||
    this.layoutCache.randomizeWalls !== this.randomizeWalls ||
    this.layoutCache.wallRandomMin !== this.wallRandomMin ||
    this.layoutCache.wallRandomMax !== this.wallRandomMax
  ) {
    this.layoutCache = this.computeLayout();
  }

  return this.layoutCache;
};

Maze.prototype.getCanvasSize = function () {
  const layout = this.getLayout();
  return { width: layout.canvasWidth, height: layout.canvasHeight };
};

Maze.prototype.getColumnRect = function (index) {
  const layout = this.getLayout();
  return { x: layout.columnStarts[index], width: layout.columnWidths[index] };
};

Maze.prototype.getRowRect = function (index) {
  const layout = this.getLayout();
  return { y: layout.rowStarts[index], height: layout.rowHeights[index] };
};

Maze.prototype.getCellRect = function (x, y) {
  const columnRect = this.getColumnRect(x);
  const rowRect = this.getRowRect(y);
  return {
    x: columnRect.x,
    y: rowRect.y,
    width: columnRect.width,
    height: rowRect.height,
  };
};

Maze.prototype.getColumnSpan = function (start, end) {
  const layout = this.getLayout();
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const x = layout.columnStarts[from];
  const width = layout.columnStarts[to] + layout.columnWidths[to] - x;
  return { x, width };
};

Maze.prototype.getRowSpan = function (start, end) {
  const layout = this.getLayout();
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const y = layout.rowStarts[from];
  const height = layout.rowStarts[to] + layout.rowHeights[to] - y;
  return { y, height };
};

Maze.prototype.generateNodes = function () {
  const count = this.width * this.height;
  let nodes = [];

  for (let i = 0; i < count; i++) {
    // visited, nswe
    nodes[i] = "01111";
  }

  return nodes;
};

Maze.prototype.parseMaze = function (nodes) {
  const mazeSize = nodes.length;
  const positionIndex = { n: 1, s: 2, w: 3, e: 4 };
  const oppositeIndex = { n: 2, s: 1, w: 4, e: 3 };

  if (!mazeSize) {
    return;
  }

  let max = 0;
  let moveNodes = [];
  let visited = 0;
  let position = parseInt(Math.floor(Math.random() * nodes.length), 10);

  let biasCount = 0;
  let biasFactor = 3;
  if (this.bias) {
    if ("horizontal" === this.bias) {
      biasFactor = 1 <= this.width / 100 ? Math.floor(this.width / 100) + 2 : 3;
    } else if ("vertical" === this.bias) {
      biasFactor =
        1 <= this.height / 100 ? Math.floor(this.height / 100) + 2 : 3;
    }
  }

  // Set start node visited.
  nodes[position] = replaceAt(nodes[position], 0, 1);

  while (visited < mazeSize - 1) {
    biasCount++;

    max++;
    if (this.maxMaze && this.maxMaze < max) {
      alert("Please use smaller maze dimensions");
      move_nodes = [];
      this.matrix = [];
      return [];
    }

    let next = this.getNeighbours(position);
    let directions = Object.keys(next).filter(function (key) {
      return -1 !== next[key] && !stringVal(this[next[key]], 0);
    }, nodes);

    if (this.bias && biasCount !== biasFactor) {
      directions = this.biasDirections(directions);
    } else {
      biasCount = 0;
    }

    if (directions.length) {
      ++visited;

      if (1 < directions.length) {
        moveNodes.push(position);
      }

      let direction = directions[Math.floor(Math.random() * directions.length)];

      // Update current position
      nodes[position] = replaceAt(nodes[position], positionIndex[direction], 0);
      // Set new position
      position = next[direction];

      // Update next position
      nodes[position] = replaceAt(nodes[position], oppositeIndex[direction], 0);
      nodes[position] = replaceAt(nodes[position], 0, 1);
    } else {
      if (!moveNodes.length) {
        break;
      }

      position = moveNodes.pop();
    }
  }

  return nodes;
};

Maze.prototype.getMatrix = function (nodes) {
  const mazeSize = this.width * this.height;

  // Add the complete maze in a matrix
  // where 1 is a wall and 0 is a corridor.

  let row1 = "";
  let row2 = "";

  if (nodes.length !== mazeSize) {
    return;
  }

  for (let i = 0; i < mazeSize; i++) {
    row1 += !row1.length ? "1" : "";
    row2 += !row2.length ? "1" : "";

    if (stringVal(nodes[i], 1)) {
      row1 += "11";
      if (stringVal(nodes[i], 4)) {
        row2 += "01";
      } else {
        row2 += "00";
      }
    } else {
      let hasAbove = nodes.hasOwnProperty(i - this.width);
      let above = hasAbove && stringVal(nodes[i - this.width], 4);
      let hasNext = nodes.hasOwnProperty(i + 1);
      let next = hasNext && stringVal(nodes[i + 1], 1);

      if (stringVal(nodes[i], 4)) {
        row1 += "01";
        row2 += "01";
      } else if (next || above) {
        row1 += "01";
        row2 += "00";
      } else {
        row1 += "00";
        row2 += "00";
      }
    }

    if (0 === (i + 1) % this.width) {
      this.matrix.push(row1);
      this.matrix.push(row2);
      row1 = "";
      row2 = "";
    }
  }

  // Add closing row
  this.matrix.push("1".repeat(this.width * 2 + 1));
};

Maze.prototype.getEntryNodes = function (access) {
  const y = this.height * 2 + 1 - 2;
  const x = this.width * 2 + 1 - 2;

  const entryNodes = {};
  const extraGates = [];
  const usedGateKeys = new Set();
  const perimeter = this.getPerimeterGates();

  const registerNode = (node) => {
    if (node && node.gate) {
      usedGateKeys.add(`${node.gate.x},${node.gate.y}`);
    }
    return node;
  };

  const addGate = (gate) => {
    if (!gate) {
      return;
    }
    const key = `${gate.x},${gate.y}`;
    if (!usedGateKeys.has(key)) {
      usedGateKeys.add(key);
      extraGates.push({ x: gate.x, y: gate.y });
    }
  };

  if ("random" === access) {
    if (perimeter.length >= 2) {
      const pool = perimeter.slice();
      shuffleArray(pool);
      const startCandidate = pool[0];
      let endCandidate = null;
      for (let i = 1; i < pool.length; i++) {
        if (pool[i].key !== startCandidate.key) {
          endCandidate = pool[i];
          break;
        }
      }
      if (!endCandidate && pool.length > 1) {
        endCandidate = pool[1];
      }

      if (startCandidate) {
        entryNodes.start = registerNode({
          x: startCandidate.node.x,
          y: startCandidate.node.y,
          gate: { x: startCandidate.gate.x, y: startCandidate.gate.y },
        });
      }

      if (endCandidate) {
        entryNodes.end = registerNode({
          x: endCandidate.node.x,
          y: endCandidate.node.y,
          gate: { x: endCandidate.gate.x, y: endCandidate.gate.y },
        });
      }
    }
  } else if ("all" === access) {
    entryNodes.start = registerNode({ x: 1, y: 1, gate: { x: 0, y: 1 } });
    entryNodes.end = registerNode({ x: x, y: y, gate: { x: x + 1, y: y } });
    for (let i = 0; i < perimeter.length; i++) {
      addGate(perimeter[i].gate);
    }
  } else if ("diagonal" === access) {
    entryNodes.start = registerNode({ x: 1, y: 1, gate: { x: 0, y: 1 } });
    entryNodes.end = registerNode({ x: x, y: y, gate: { x: x + 1, y: y } });
  } else if ("horizontal" === access || "vertical" === access) {
    let xy = "horizontal" === access ? y : x;
    xy = (xy - 1) / 2;
    let even = xy % 2 === 0;
    xy = even ? xy + 1 : xy;

    let start_x = "horizontal" === access ? 1 : xy;
    let start_y = "horizontal" === access ? xy : 1;
    let end_x = "horizontal" === access ? x : even ? start_x : start_x + 2;
    let end_y = "horizontal" === access ? (even ? start_y : start_y + 2) : y;
    let startgate =
      "horizontal" === access ? { x: 0, y: start_y } : { x: start_x, y: 0 };
    let endgate =
      "horizontal" === access ? { x: x + 1, y: end_y } : { x: end_x, y: y + 1 };

    entryNodes.start = registerNode({
      x: start_x,
      y: start_y,
      gate: { x: startgate.x, y: startgate.y },
    });
    entryNodes.end = registerNode({
      x: end_x,
      y: end_y,
      gate: { x: endgate.x, y: endgate.y },
    });
  }

  return { nodes: entryNodes, extraGates, usedGateKeys };
};

Maze.prototype.getPerimeterGates = function () {
  const gates = [];
  const columns = this.width * 2 + 1;
  const rows = this.height * 2 + 1;

  for (let row = 0; row < this.height; row++) {
    const y = row * 2 + 1;
    gates.push({
      key: `0,${y}`,
      node: { x: 1, y: y },
      gate: { x: 0, y: y },
    });
    gates.push({
      key: `${columns - 1},${y}`,
      node: { x: columns - 2, y: y },
      gate: { x: columns - 1, y: y },
    });
  }

  for (let column = 0; column < this.width; column++) {
    const x = column * 2 + 1;
    gates.push({
      key: `${x},0`,
      node: { x: x, y: 1 },
      gate: { x: x, y: 0 },
    });
    gates.push({
      key: `${x},${rows - 1}`,
      node: { x: x, y: rows - 2 },
      gate: { x: x, y: rows - 1 },
    });
  }

  return gates;
};

Maze.prototype.addExtraExits = function (count) {
  if (!count) {
    return;
  }

  if (!(this.usedGateSet instanceof Set)) {
    this.usedGateSet = new Set();
  }

  if (!Array.isArray(this.extraGates)) {
    this.extraGates = [];
  }

  const perimeter = this.getPerimeterGates();
  const available = [];

  for (let i = 0; i < perimeter.length; i++) {
    const key = perimeter[i].key;
    if (!this.usedGateSet.has(key)) {
      available.push(perimeter[i]);
    }
  }

  if (!available.length) {
    return;
  }

  shuffleArray(available);

  const max = Math.min(count, available.length);
  for (let i = 0; i < max; i++) {
    const gate = available[i].gate;
    const key = available[i].key;
    if (!this.usedGateSet.has(key)) {
      this.usedGateSet.add(key);
      this.extraGates.push({ x: gate.x, y: gate.y });
    }
  }
};

Maze.prototype.biasDirections = function (directions) {
  const horizontal =
    -1 !== directions.indexOf("w") || -1 !== directions.indexOf("e");
  const vertical =
    -1 !== directions.indexOf("n") || -1 !== directions.indexOf("s");

  if ("horizontal" === this.bias && horizontal) {
    directions = directions.filter(function (key) {
      return "w" === key || "e" === key;
    });
  } else if ("vertical" === this.bias && vertical) {
    directions = directions.filter(function (key) {
      return "n" === key || "s" === key;
    });
  }

  return directions;
};

Maze.prototype.getNeighbours = function (pos) {
  return {
    n: 0 <= pos - this.width ? pos - this.width : -1,
    s: this.width * this.height > pos + this.width ? pos + this.width : -1,
    w: 0 < pos && 0 !== pos % this.width ? pos - 1 : -1,
    e: 0 !== (pos + 1) % this.width ? pos + 1 : -1,
  };
};

Maze.prototype.removeWall = function (row, index) {
  // Remove wall if possible.
  const evenRow = row % 2 === 0;
  const evenIndex = index % 2 === 0;
  const wall = stringVal(this.matrix[row], index);

  if (!wall) {
    return false;
  }

  if (!evenRow && evenIndex) {
    // Uneven row and even column
    const hasTop = row - 2 > 0 && 1 === stringVal(this.matrix[row - 2], index);
    const hasBottom =
      row + 2 < this.matrix.length &&
      1 === stringVal(this.matrix[row + 2], index);

    if (hasTop && hasBottom) {
      this.matrix[row] = replaceAt(this.matrix[row], index, "0");
      return true;
    } else if (!hasTop && hasBottom) {
      const left = 1 === stringVal(this.matrix[row - 1], index - 1);
      const right = 1 === stringVal(this.matrix[row - 1], index + 1);
      if (left || right) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    } else if (!hasBottom && hasTop) {
      const left = 1 === stringVal(this.matrix[row + 1], index - 1);
      const right = 1 === stringVal(this.matrix[row + 1], index + 1);
      if (left || right) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    }
  } else if (evenRow && !evenIndex) {
    // Even row and uneven column
    const hasLeft = 1 === stringVal(this.matrix[row], index - 2);
    const hasRight = 1 === stringVal(this.matrix[row], index + 2);

    if (hasLeft && hasRight) {
      this.matrix[row] = replaceAt(this.matrix[row], index, "0");
      return true;
    } else if (!hasLeft && hasRight) {
      const top = 1 === stringVal(this.matrix[row - 1], index - 1);
      const bottom = 1 === stringVal(this.matrix[row + 1], index - 1);
      if (top || bottom) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    } else if (!hasRight && hasLeft) {
      const top = 1 === stringVal(this.matrix[row - 1], index + 1);
      const bottom = 1 === stringVal(this.matrix[row + 1], index + 1);
      if (top || bottom) {
        this.matrix[row] = replaceAt(this.matrix[row], index, "0");
        return true;
      }
    }
  }

  return false;
};

Maze.prototype.removeMazeWalls = function () {
  if (!this.removeWalls || !this.matrix.length) {
    return;
  }

  const min = 1;
  const max = this.matrix.length - 1;
  const maxTries = this.maxWallsRemove;
  let tries = 0;

  while (tries < maxTries) {
    tries++;

    // Did we reached the goal
    if (this.wallsRemoved >= this.removeWalls) {
      break;
    }

    // Get random row from matrix
    let y = Math.floor(Math.random() * (max - min + 1)) + min;
    y = y === max ? y - 1 : y;

    let walls = [];
    let row = this.matrix[y];

    // Get walls from random row
    for (let i = 0; i < row.length; i++) {
      if (i === 0 || i === row.length - 1) {
        continue;
      }

      const wall = stringVal(row, i);
      if (wall) {
        walls.push(i);
      }
    }

    // Shuffle walls randomly
    shuffleArray(walls);

    // Try breaking a wall for this row.
    for (let i = 0; i < walls.length; i++) {
      if (this.removeWall(y, walls[i])) {
        // Wall can be broken
        this.wallsRemoved++;
        break;
      }
    }
  }
};

Maze.prototype.usesOrganicWalls = function () {
  return this.wallStyle !== "grid" && this.wallShapeVariance > 0;
};

Maze.prototype.getOrganicAnglePalette = function () {
  return [0, 30, 45, 60, 90, 120];
};

Maze.prototype.generateOrganicPolyline = function (
  startX,
  startY,
  endX,
  endY,
  variance,
  options
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const axisLength = Math.hypot(dx, dy);
  if (axisLength === 0) {
    return [{ x: startX, y: startY }, { x: endX, y: endY }];
  }

  const axisDirX = dx / axisLength;
  const axisDirY = dy / axisLength;
  const perpDirX = -axisDirY;
  const perpDirY = axisDirX;
  const maxDetourBase = options && options.maxDetour ? options.maxDetour : axisLength * 0.25;
  const maxDetour = Math.max(1, Math.min(axisLength * 0.45, maxDetourBase));
  const clampedVariance = Math.max(0, Math.min(1, variance || 0));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  let segmentCount = Math.round(clampedVariance * 5);
  if (clampedVariance > 0 && segmentCount === 0) {
    segmentCount = 1;
  }
  segmentCount = Math.min(6, Math.max(0, segmentCount));

  if (segmentCount === 0) {
    return [
      { x: startX, y: startY },
      { x: endX, y: endY },
    ];
  }

  const anglePalette = this.getOrganicAnglePalette();
  const orientedAngles = [];
  for (let i = 0; i < anglePalette.length; i++) {
    const base = anglePalette[i];
    if (base === 0) {
      orientedAngles.push(0);
      continue;
    }
    if (base === 90) {
      continue;
    }
    const radians = (base * Math.PI) / 180;
    orientedAngles.push(radians, -radians);
  }
  if (!orientedAngles.length) {
    orientedAngles.push(0);
  }

  const minSegment = Math.max(2, axisLength / (segmentCount + 1) * 0.6);
  const maxSegment = Math.max(minSegment, axisLength / (segmentCount + 1) * 1.45);

  const localPoints = [{ progress: 0, offset: 0 }];
  let progress = 0;
  let offset = 0;

  const chooseAngle = (biasTowardCenter) => {
    const pool = [];
    for (let i = 0; i < orientedAngles.length; i++) {
      const angle = orientedAngles[i];
      if (Math.abs(angle) >= Math.PI / 2 - 0.05) {
        continue;
      }
      if (biasTowardCenter && Math.abs(offset) > 0.01) {
        if (offset > 0 && angle > 0) {
          continue;
        }
        if (offset < 0 && angle < 0) {
          continue;
        }
      }
      pool.push(angle);
    }

    if (!pool.length) {
      return 0;
    }

    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  };

  for (let i = 0; i < segmentCount; i++) {
    const segmentsLeft = segmentCount - i - 1;
    const remainingAxis = axisLength - progress;
    if (remainingAxis <= minSegment) {
      break;
    }

    const maxForThis = Math.max(minSegment, Math.min(maxSegment, remainingAxis - segmentsLeft * minSegment));
    const minForThis = Math.max(minSegment, Math.min(maxForThis, remainingAxis / (segmentsLeft + 1) * 0.7));

    let dxLocal = minForThis;
    let dyLocal = 0;
    let attempts = 0;
    const biasCenter = Math.abs(offset) > maxDetour * 0.55;
    while (attempts < 8) {
      const candidateAngle = chooseAngle(biasCenter);
      const candidateDx = clamp(randomInRange(minForThis, maxForThis), minSegment, maxForThis);
      const slope = Math.tan(candidateAngle);
      const candidateDy = candidateDx * slope;
      if (Math.abs(offset + candidateDy) <= maxDetour * 0.95) {
        dxLocal = candidateDx;
        dyLocal = candidateDy;
        break;
      }
      attempts++;
    }

    progress += dxLocal;
    offset = clamp(offset + dyLocal, -maxDetour, maxDetour);
    localPoints.push({ progress, offset });
  }

  if (axisLength - progress > 1) {
    progress = axisLength;
    localPoints.push({ progress, offset });
  } else {
    progress = axisLength;
  }

  if (Math.abs(offset) > 0.5) {
    const settle = clamp(offset * 0.35, -maxDetour * 0.4, maxDetour * 0.4);
    if (Math.abs(settle - offset) > 0.25) {
      localPoints.push({ progress: axisLength, offset: settle });
      offset = settle;
    }
    localPoints.push({ progress: axisLength, offset: 0 });
  } else {
    localPoints.push({ progress: axisLength, offset: 0 });
  }

  const points = [];
  for (let i = 0; i < localPoints.length; i++) {
    const local = localPoints[i];
    const x = startX + axisDirX * local.progress + perpDirX * local.offset;
    const y = startY + axisDirY * local.progress + perpDirY * local.offset;
    if (
      points.length === 0 ||
      Math.hypot(points[points.length - 1].x - x, points[points.length - 1].y - y) > 0.5
    ) {
      points.push({ x, y });
    }
  }

  if (points.length === 1 || Math.hypot(points[points.length - 1].x - endX, points[points.length - 1].y - endY) > 0.5) {
    points.push({ x: endX, y: endY });
  }

  return points;
};

Maze.prototype.getWallShapeKey = function (x, y) {
  return `${x},${y}`;
};

Maze.prototype.getWallShape = function (x, y, rect) {
  if (!this.usesOrganicWalls()) {
    return { type: "grid" };
  }

  if (!(this.wallShapeCache instanceof Map)) {
    this.wallShapeCache = new Map();
  }

  const key = this.getWallShapeKey(x, y);
  if (!this.wallShapeCache.has(key)) {
    const shape = this.createWallShape(rect);
    this.wallShapeCache.set(key, shape);
  }

  return this.wallShapeCache.get(key);
};

Maze.prototype.createWallShape = function (rect) {
  const variance = Math.max(0, Math.min(1, this.wallShapeVariance || 0));
  if (variance <= 0) {
    return { type: "grid" };
  }

  let style = this.wallStyle;
  if (style === "organic") {
    style = Math.random() < 0.5 ? "curved" : "angled";
  }

  if (style === "curved") {
    return this.createCurvedWallShape(rect, variance);
  }

  if (style === "angled") {
    return this.createAngledWallShape(rect, variance);
  }

  return { type: "grid" };
};

Maze.prototype.createCurvedWallShape = function (rect, variance) {
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) {
    return { type: "grid" };
  }

  const maxRadius = Math.min(width, height) * 0.5 * variance;
  if (maxRadius <= 0) {
    return { type: "grid" };
  }

  const randomRadius = () => Math.max(0, Math.random() * maxRadius);

  return {
    type: "curved",
    radii: {
      tl: randomRadius(),
      tr: randomRadius(),
      br: randomRadius(),
      bl: randomRadius(),
    },
  };
};

Maze.prototype.createAngledWallShape = function (rect, variance) {
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) {
    return { type: "grid" };
  }

  const spanX = Math.max(1, width * 0.45 * variance);
  const spanY = Math.max(1, height * 0.45 * variance);
  const jitter = (span) => (Math.random() * 2 - 1) * span;
  const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

  const marginX = spanX;
  const marginY = spanY;

  const points = [
    { x: clampValue(jitter(marginX), -marginX, marginX), y: clampValue(jitter(marginY), -marginY, marginY) },
    { x: clampValue(width * 0.35 + jitter(spanX * 0.5), -marginX, width + marginX), y: clampValue(jitter(marginY), -marginY, marginY) },
    { x: clampValue(width + jitter(marginX), -marginX, width + marginX), y: clampValue(jitter(marginY), -marginY, marginY) },
    { x: clampValue(width + jitter(marginX), -marginX, width + marginX), y: clampValue(height * 0.35 + jitter(spanY * 0.5), -marginY, height + marginY) },
    { x: clampValue(width + jitter(marginX * 0.7), -marginX, width + marginX), y: clampValue(height + jitter(marginY), -marginY, height + marginY) },
    { x: clampValue(width * 0.65 + jitter(spanX * 0.5), -marginX, width + marginX), y: clampValue(height + jitter(marginY), -marginY, height + marginY) },
    { x: clampValue(jitter(marginX), -marginX, marginX), y: clampValue(height + jitter(marginY), -marginY, height + marginY) },
    { x: clampValue(jitter(marginX), -marginX, marginX), y: clampValue(height * 0.65 + jitter(spanY * 0.5), -marginY, height + marginY) },
  ];

  return { type: "angled", points };
};

Maze.prototype.drawWallCell = function (ctx, rect, shape) {
  if (!shape || shape.type === "grid") {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  ctx.save();
  ctx.beginPath();

  if (shape.type === "curved") {
    this.traceCurvedMaskPath(ctx, rect, shape);
  } else if (shape.type === "angled") {
    this.traceAngledMaskPath(ctx, rect, shape);
  } else {
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

Maze.prototype.drawOrganicMaze = function (ctx, layout) {
  const rows = this.matrix.length;
  if (!rows) {
    return;
  }

  const columns = this.matrix[0].length;
  const columnCenters = new Array(columns);
  const rowCenters = new Array(rows);

  if (!(this.organicEdgeCache instanceof Map)) {
    this.organicEdgeCache = new Map();
  }

  if (!(this.organicNodeCache instanceof Map)) {
    this.organicNodeCache = new Map();
  }

  for (let i = 0; i < columns; i++) {
    columnCenters[i] = layout.columnStarts[i] + layout.columnWidths[i] / 2;
  }

  for (let j = 0; j < rows; j++) {
    rowCenters[j] = layout.rowStarts[j] + layout.rowHeights[j] / 2;
  }

  const variance = Math.max(0, Math.min(1, this.wallShapeVariance || 0));
  const baseWidth = Math.max(1, this.passageSize);
  const minWidth = Math.max(1, baseWidth * (1 - 0.45 * variance));
  const maxWidth = Math.max(minWidth, baseWidth * (1 + 0.65 * variance));

  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  const getNodeKey = (x, y) => `${x},${y}`;
  const getEdgeKey = (x1, y1, x2, y2) => {
    if (x1 > x2 || (x1 === x2 && y1 > y2)) {
      const swapX = x1;
      const swapY = y1;
      x1 = x2;
      y1 = y2;
      x2 = swapX;
      y2 = swapY;
    }
    return `${x1},${y1}|${x2},${y2}`;
  };

  const getBoundaryKey = (x, y, axis, index, forward) =>
    `${x},${y}|${axis}${index}:${forward ? "1" : "-1"}`;

  const getNodeRadius = (x, y) => {
    const key = getNodeKey(x, y);
    if (!this.organicNodeCache.has(key)) {
      const radius = randomInRange(minWidth, maxWidth) / 2;
      this.organicNodeCache.set(key, radius);
    }
    return this.organicNodeCache.get(key);
  };

  const getEdgeShape = (x1, y1, x2, y2) => {
    const key = getEdgeKey(x1, y1, x2, y2);
    if (!this.organicEdgeCache.has(key)) {
      const width = randomInRange(minWidth, maxWidth);
      const startX = columnCenters[x1];
      const startY = rowCenters[y1];
      const endX = columnCenters[x2];
      const endY = rowCenters[y2];
      const points = this.generateOrganicPolyline(startX, startY, endX, endY, variance, {
        maxDetour: Math.max(width * 1.5, this.wallThickness * 1.25),
      });
      this.organicEdgeCache.set(key, {
        width,
        points,
      });
    }

    return this.organicEdgeCache.get(key);
  };

  const getBoundaryShape = (x, y, boundaryIndex, horizontal, forward) => {
    const axisKey = horizontal ? "h" : "v";
    const key = getBoundaryKey(x, y, axisKey, boundaryIndex, forward);
    if (!this.organicEdgeCache.has(key)) {
      const width = randomInRange(minWidth, maxWidth);
      const startX = columnCenters[x];
      const startY = rowCenters[y];
      let endX = startX;
      let endY = startY;
      if (horizontal) {
        const boundaryStart = layout.columnStarts[boundaryIndex];
        const boundaryWidth = layout.columnWidths[boundaryIndex];
        endX = forward ? boundaryStart + boundaryWidth : boundaryStart;
      } else {
        const boundaryStart = layout.rowStarts[boundaryIndex];
        const boundaryHeight = layout.rowHeights[boundaryIndex];
        endY = forward ? boundaryStart + boundaryHeight : boundaryStart;
      }

      const points = this.generateOrganicPolyline(startX, startY, endX, endY, variance, {
        maxDetour: Math.max(width * 1.35, this.wallThickness * 1.25),
      });

      this.organicEdgeCache.set(key, {
        width,
        points,
      });
    }

    return this.organicEdgeCache.get(key);
  };

  const carveEdge = (x1, y1, x2, y2) => {
    const shape = getEdgeShape(x1, y1, x2, y2);
    const points = Array.isArray(shape.points) ? shape.points : [];
    if (points.length < 2) {
      return;
    }
    ctx.beginPath();
    ctx.lineWidth = shape.width;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  };

  const carveBoundaryEdge = (x, y, boundaryIndex, horizontal, forward) => {
    const shape = getBoundaryShape(x, y, boundaryIndex, horizontal, forward);
    const points = Array.isArray(shape.points) ? shape.points : [];
    if (points.length < 2) {
      return;
    }
    ctx.beginPath();
    ctx.lineWidth = shape.width;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  };

  const carveNode = (x, y) => {
    const radius = getNodeRadius(x, y);
    if (radius <= 0) {
      return;
    }
    ctx.beginPath();
    ctx.arc(columnCenters[x], rowCenters[y], radius, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  ctx.strokeStyle = this.color;
  ctx.fillStyle = this.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let y = 1; y < rows; y += 2) {
    for (let x = 1; x < columns; x += 2) {
      if (this.matrix[y].charAt(x) !== "0") {
        continue;
      }

      carveNode(x, y);

      if (x + 2 < columns && this.matrix[y].charAt(x + 1) === "0" && this.matrix[y].charAt(x + 2) === "0") {
        carveEdge(x, y, x + 2, y);
      } else if (x + 1 < columns && this.matrix[y].charAt(x + 1) === "0") {
        carveBoundaryEdge(x, y, x + 1, true, true);
      }

      if (y + 2 < rows && this.matrix[y + 1].charAt(x) === "0" && this.matrix[y + 2].charAt(x) === "0") {
        carveEdge(x, y, x, y + 2);
      } else if (y + 1 < rows && this.matrix[y + 1].charAt(x) === "0") {
        carveBoundaryEdge(x, y, y + 1, false, true);
      }

      if (
        this.matrix[y].charAt(x - 1) === "0" &&
        (x - 2 < 0 || this.matrix[y].charAt(x - 2) !== "0")
      ) {
        carveBoundaryEdge(x, y, x - 1, true, false);
      }

      if (
        this.matrix[y - 1] &&
        this.matrix[y - 1].charAt(x) === "0" &&
        (y - 2 < 0 || this.matrix[y - 2].charAt(x) !== "0")
      ) {
        carveBoundaryEdge(x, y, y - 1, false, false);
      }
    }
  }

  ctx.restore();

  if (this.hideOuterBorder) {
    ctx.save();
    ctx.fillStyle = this.backgroundColor;
    const lastRow = rows - 1;
    const lastColumn = columns - 1;
    ctx.fillRect(0, 0, layout.canvasWidth, layout.rowHeights[0]);
    ctx.fillRect(0, layout.rowStarts[lastRow], layout.canvasWidth, layout.rowHeights[lastRow]);
    ctx.fillRect(0, 0, layout.columnWidths[0], layout.canvasHeight);
    ctx.fillRect(layout.columnStarts[lastColumn], 0, layout.columnWidths[lastColumn], layout.canvasHeight);
    ctx.restore();
  }
};

Maze.prototype.traceCurvedMaskPath = function (ctx, rect, shape) {
  const { x, y, width, height } = rect;
  const radii = (shape && shape.radii) || {};
  const clampRadius = (radius) => {
    const maxRadius = Math.min(width, height) / 2;
    return Math.max(0, Math.min(maxRadius, radius || 0));
  };

  const tl = clampRadius(radii.tl);
  const tr = clampRadius(radii.tr);
  const br = clampRadius(radii.br);
  const bl = clampRadius(radii.bl);

  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
};

Maze.prototype.traceAngledMaskPath = function (ctx, rect, shape) {
  const points = Array.isArray(shape && shape.points) ? shape.points : null;
  if (!points || points.length < 3) {
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    return;
  }

  ctx.moveTo(rect.x + points[0].x, rect.y + points[0].y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    ctx.lineTo(rect.x + point.x, rect.y + point.y);
  }
};

Maze.prototype.draw = function () {
  const canvas = document.getElementById("maze");
  if (!canvas || !this.matrix.length) {
    return;
  }

  if (!this.isValidSize()) {
    this.matrix = [];
    alert("Please use smaller maze dimensions");
    return;
  }

  const layout = this.getLayout();
  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Add background
  ctx.fillStyle = this.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set maze collor
  ctx.fillStyle = this.color;
  const organicWalls = this.usesOrganicWalls();

  if (organicWalls) {
    this.drawOrganicMaze(ctx, layout);
    return;
  }

  const row_count = this.matrix.length;
  const gateEntry = getEntryNode(this.entryNodes, "start", true);
  const gateExit = getEntryNode(this.entryNodes, "end", true);
  const gateSkip = new Set();

  if (gateEntry) {
    gateSkip.add(`${gateEntry.x},${gateEntry.y}`);
  }

  if (gateExit) {
    gateSkip.add(`${gateExit.x},${gateExit.y}`);
  }

  if (Array.isArray(this.extraGates)) {
    for (let i = 0; i < this.extraGates.length; i++) {
      const gate = this.extraGates[i];
      gateSkip.add(`${gate.x},${gate.y}`);
    }
  }

  const lastRow = row_count - 1;
  for (let i = 0; i < row_count; i++) {
    const row_length = this.matrix[i].length;
    const lastColumn = row_length - 1;
    for (let j = 0; j < row_length; j++) {
      if (
        this.hideOuterBorder &&
        (i === 0 || j === 0 || i === lastRow || j === lastColumn)
      ) {
        continue;
      }

      if (gateSkip.has(`${j},${i}`)) {
        continue;
      }

      let pixel = parseInt(this.matrix[i].charAt(j), 10);
      if (pixel) {
        const rect = this.getCellRect(j, i);
        if (organicWalls) {
          const shape = this.getWallShape(j, i, rect);
          this.drawWallCell(ctx, rect, shape);
        } else {
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
      }
    }
  }
};
