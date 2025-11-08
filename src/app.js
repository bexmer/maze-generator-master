// Global variables
let mazeNodes = {};

const wallSizeInput = document.getElementById("wall-size");
const wallSizeValue = document.getElementById("wall-size-value");
const randomizeWallInput = document.getElementById("randomize-wall");
const wallRangeMinInput = document.getElementById("wall-size-min");
const wallRangeMaxInput = document.getElementById("wall-size-max");
const passageSizeInput = document.getElementById("passage-size");
const passageSizeValue = document.getElementById("passage-size-value");
const wallStyleInput = document.getElementById("wall-style");
const algorithmInput = document.getElementById("algorithm");
const wallVarianceInput = document.getElementById("wall-variance");
const wallVarianceValue = document.getElementById("wall-variance-value");
const removeBorderInput = document.getElementById("remove-border");
const extraExitsInput = document.getElementById("extra-exits");
const organicOptionsContainer = document.getElementById("organic-options");
const organicWidthInput = document.getElementById("organic-width");
const organicHeightInput = document.getElementById("organic-height");
const organicPointInput = document.getElementById("organic-points");
const organicAlgorithmInput = document.getElementById("organic-algorithm");
const organicJitterInput = document.getElementById("organic-jitter");
const organicJitterPointsInput = document.getElementById("organic-jitter-points");
const organicSeedInput = document.getElementById("organic-seed");
const organicOnlyDisabledControls = [
  document.getElementById("passage-size"),
  removeBorderInput,
  extraExitsInput,
  document.getElementById("entry"),
  document.getElementById("bias"),
  document.getElementById("remove_walls"),
  algorithmInput,
];

let lastMazeType = "grid";

const wallSliderMin = wallSizeInput
  ? Math.max(1, parseInt(wallSizeInput.min, 10) || 1)
  : 1;
const wallSliderMax = wallSizeInput
  ? Math.max(wallSliderMin, parseInt(wallSizeInput.max, 10) || wallSliderMin)
  : wallSliderMin;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseBoundedInt = (input, fallback, minBound, maxBound) => {
  if (!input) {
    return clamp(fallback, minBound, maxBound);
  }

  let value = parseInt(input.value, 10);
  if (Number.isNaN(value)) {
    value = fallback;
  }

  value = clamp(value, minBound, maxBound);
  input.value = value;
  return value;
};

const parseNumberInput = (input, fallback, minBound, maxBound, { isFloat } = {}) => {
  let value = fallback;
  if (input) {
    value = isFloat ? parseFloat(input.value) : parseInt(input.value, 10);
  }

  if (Number.isNaN(value)) {
    value = fallback;
  }

  if (typeof minBound === "number") {
    value = Math.max(minBound, value);
  }

  if (typeof maxBound === "number") {
    value = Math.min(maxBound, value);
  }

  if (input) {
    input.value = value;
  }

  return value;
};

const getWallRandomRange = () => {
  const minValue = parseBoundedInt(
    wallRangeMinInput,
    wallSliderMin,
    wallSliderMin,
    wallSliderMax
  );
  let maxValue = parseBoundedInt(
    wallRangeMaxInput,
    wallSliderMax,
    wallSliderMin,
    wallSliderMax
  );

  if (maxValue < minValue) {
    maxValue = minValue;
    if (wallRangeMaxInput) {
      wallRangeMaxInput.value = maxValue;
    }
  }

  return { min: minValue, max: maxValue };
};

const syncWallSliderEnabledState = () => {
  const randomizeWalls = !!(randomizeWallInput && randomizeWallInput.checked);
  if (wallSizeInput) {
    wallSizeInput.disabled = randomizeWalls;
  }
  if (wallRangeMinInput) {
    wallRangeMinInput.disabled = !randomizeWalls;
  }
  if (wallRangeMaxInput) {
    wallRangeMaxInput.disabled = !randomizeWalls;
  }
};

const updateWallSizeDisplay = ({ range } = {}) => {
  if (!wallSizeValue) {
    return;
  }

  const randomizeWalls = !!(randomizeWallInput && randomizeWallInput.checked);
  if (randomizeWalls) {
    const activeRange = range || getWallRandomRange();
    wallSizeValue.textContent = `Random (${activeRange.min}-${activeRange.max} px)`;
  } else if (wallSizeInput) {
    wallSizeValue.textContent = `${wallSizeInput.value} px`;
  }
};

const updatePassageDisplay = () => {
  if (passageSizeValue && passageSizeInput) {
    passageSizeValue.textContent = `${passageSizeInput.value} px`;
  }
};

const updateWallVarianceDisplay = () => {
  if (!wallVarianceValue || !wallVarianceInput) {
    return;
  }

  const style = wallStyleInput ? wallStyleInput.value : "grid";
  if (style === "grid" || style === "organic-graph") {
    wallVarianceValue.textContent = "off";
  } else {
    wallVarianceValue.textContent = `${wallVarianceInput.value}%`;
  }
};

const syncWallVarianceState = () => {
  if (!wallVarianceInput) {
    return;
  }

  const style = wallStyleInput ? wallStyleInput.value : "grid";
  wallVarianceInput.disabled = style === "grid" || style === "organic-graph";
  updateWallVarianceDisplay();
};

const isOrganicGraphStyle = () => wallStyleInput && wallStyleInput.value === "organic-graph";

const toggleOrganicOptionVisibility = () => {
  const useOrganic = isOrganicGraphStyle();
  if (organicOptionsContainer) {
    organicOptionsContainer.classList.toggle("hide", !useOrganic);
  }

  if (useOrganic) {
    const solveButton = document.getElementById("solve");
    if (solveButton && !solveButton.classList.contains("hide")) {
      solveButton.classList.add("hide");
    }
  }

  organicOnlyDisabledControls.forEach((control) => {
    if (!control) {
      return;
    }
    if (useOrganic) {
      control.dataset.prevDisabled = control.disabled ? "1" : "0";
      control.disabled = true;
    } else if (control.dataset && typeof control.dataset.prevDisabled !== "undefined") {
      control.disabled = control.dataset.prevDisabled === "1";
      delete control.dataset.prevDisabled;
    } else {
      control.disabled = false;
    }
  });
};

if (wallSizeInput && wallSizeValue) {
  updateWallSizeDisplay();

  wallSizeInput.addEventListener("input", () => {
    if (randomizeWallInput && randomizeWallInput.checked) {
      updateWallSizeDisplay();
      return;
    }

    updateWallSizeDisplay();

    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

if (removeBorderInput) {
  removeBorderInput.addEventListener("change", () => {
    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

if (extraExitsInput) {
  extraExitsInput.addEventListener("input", () => {
    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

if (passageSizeInput && passageSizeValue) {
  passageSizeInput.addEventListener("input", () => {
    updatePassageDisplay();

    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

const onWallRangeInput = () => {
  getWallRandomRange();
  updateWallSizeDisplay();

  if (
    randomizeWallInput &&
    randomizeWallInput.checked &&
    mazeNodes.matrix &&
    mazeNodes.matrix.length
  ) {
    initMaze();
  }
};

if (randomizeWallInput) {
  randomizeWallInput.addEventListener("change", () => {
    syncWallSliderEnabledState();
    updateWallSizeDisplay();

    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

if (wallRangeMinInput) {
  wallRangeMinInput.addEventListener("input", onWallRangeInput);
}

if (wallRangeMaxInput) {
  wallRangeMaxInput.addEventListener("input", onWallRangeInput);
}

if (wallStyleInput) {
  wallStyleInput.addEventListener("change", () => {
    syncWallVarianceState();
    toggleOrganicOptionVisibility();

    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

const organicInputs = [
  organicWidthInput,
  organicHeightInput,
  organicPointInput,
  organicAlgorithmInput,
  organicJitterInput,
  organicJitterPointsInput,
  organicSeedInput,
];

organicInputs.forEach((input) => {
  if (!input) {
    return;
  }
  const eventName = input.tagName === "SELECT" ? "change" : "input";
  input.addEventListener(eventName, () => {
    if (isOrganicGraphStyle() && lastMazeType === "organic") {
      initMaze();
    }
  });
});

if (algorithmInput) {
  algorithmInput.addEventListener("change", () => {
    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

if (wallVarianceInput) {
  wallVarianceInput.addEventListener("input", () => {
    updateWallVarianceDisplay();

    if (
      wallStyleInput &&
      wallStyleInput.value !== "grid" &&
      mazeNodes.matrix &&
      mazeNodes.matrix.length
    ) {
      initMaze();
    }
  });
}

syncWallSliderEnabledState();
if (randomizeWallInput && randomizeWallInput.checked) {
  getWallRandomRange();
}
updateWallSizeDisplay();
updatePassageDisplay();
syncWallVarianceState();
toggleOrganicOptionVisibility();

// Check if globals are defined
if (typeof maxMaze === "undefined") {
  maxMaze = 0;
}

if (typeof maxSolve === "undefined") {
  maxSolve = 0;
}

if (typeof maxCanvas === "undefined") {
  maxCanvas = 0;
}

if (typeof maxCanvasDimension === "undefined") {
  maxCanvasDimension = 0;
}

if (typeof maxWallsRemove === "undefined") {
  maxWallsRemove = 300;
}

// Update remove max walls html
const removeMaxWallsText = document.querySelector(".desc span");
if (removeMaxWallsText) {
  removeMaxWallsText.innerHTML = maxWallsRemove;
}

const removeWallsInput = document.getElementById("remove_walls");
if (removeWallsInput) {
  removeWallsInput.max = maxWallsRemove;
}

const download = document.getElementById("download");
download.addEventListener("click", downloadImage, false);
download.setAttribute("download", "maze.png");

async function initMaze() {
  download.setAttribute("download", "maze.png");
  download.innerHTML = "download maze";

  const width = getInputIntVal("width", 20);
  const height = getInputIntVal("height", 20);
  const wallSize = getInputIntVal("wall-size", 10);
  const basePassageSize = getInputIntVal("passage-size", 10);
  const removeWalls = getInputIntVal("remove_walls", 0);
  const extraExits = getInputIntVal("extra-exits", 0);

  const randomizeWalls = !!(randomizeWallInput && randomizeWallInput.checked);
  let wallRange = null;
  if (randomizeWalls) {
    wallRange = getWallRandomRange();
    updateWallSizeDisplay({ range: wallRange });
  } else {
    updateWallSizeDisplay();
  }

  updatePassageDisplay();

  const wallStyle = wallStyleInput ? wallStyleInput.value : "grid";
  let varianceSetting = 0;
  if (wallVarianceInput) {
    const parsedVariance = parseInt(wallVarianceInput.value, 10);
    const minVariance = parseInt(wallVarianceInput.min, 10);
    const maxVariance = parseInt(wallVarianceInput.max, 10);
    varianceSetting = clamp(
      Number.isNaN(parsedVariance) ? 0 : parsedVariance,
      Number.isNaN(minVariance) ? 0 : minVariance,
      Number.isNaN(maxVariance) ? 100 : maxVariance
    );
    wallVarianceInput.value = varianceSetting;
    updateWallVarianceDisplay();
  }

  const settings = {
    width,
    height,
    wallSize,
    passageSize: basePassageSize,
    removeWalls,
    removeOuterBorder: removeBorderInput ? removeBorderInput.checked : false,
    extraExits,
    randomizeWalls,
    wallRandomMin: wallRange ? wallRange.min : undefined,
    wallRandomMax: wallRange ? wallRange.max : undefined,
    wallStyle,
    wallShapeVariance: varianceSetting,
    entryType: "",
    bias: "",
    color: "#000000",
    backgroundColor: "#FFFFFF",
    solveColor: "#cc3737",

    // restrictions
    maxMaze: maxMaze,
    maxCanvas: maxCanvas,
    maxCanvasDimension: maxCanvasDimension,
    maxSolve: maxSolve,
    maxWallsRemove: maxWallsRemove,
  };

  const colors = ["color", "backgroundColor", "solveColor"];
  for (let i = 0; i < colors.length; i++) {
    const colorInput = document.getElementById(colors[i]);
    settings[colors[i]] = colorInput.value;
    if (!isValidHex(settings[colors[i]])) {
      let defaultColor = colorInput.parentNode.dataset.default;
      colorInput.value = defaultColor;
      settings[colors[i]] = defaultColor;
    }

    const colorSample = colorInput.parentNode.querySelector(".color-sample");
    colorSample.style = "background-color: " + settings[colors[i]] + ";";
  }

  if (settings["removeWalls"] > maxWallsRemove) {
    settings["removeWalls"] = maxWallsRemove;
    if (removeWallsInput) {
      removeWallsInput.value = maxWallsRemove;
    }
  }

  if (settings.extraExits < 0 || isNaN(settings.extraExits)) {
    settings.extraExits = 0;
    if (extraExitsInput) {
      extraExitsInput.value = 0;
    }
  }

  const entry = document.getElementById("entry");
  if (entry) {
    settings["entryType"] = entry.options[entry.selectedIndex].value;
  }

  const bias = document.getElementById("bias");
  if (bias) {
    settings["bias"] = bias.options[bias.selectedIndex].value;
  }

  if (algorithmInput) {
    settings["algorithm"] = algorithmInput.value;
  }

  if (wallStyle === "organic-graph") {
    await renderOrganicMaze(settings);
    return;
  }

  const maze = new Maze(settings);
  maze.generate();
  maze.draw();

  if (download && download.classList.contains("hide")) {
    download.classList.toggle("hide");
  }

  const solveButton = document.getElementById("solve");
  if (solveButton && solveButton.classList.contains("hide")) {
    solveButton.classList.toggle("hide");
  }

  mazeNodes = {};
  if (maze.matrix.length) {
    mazeNodes = maze;
  }

  lastMazeType = "grid";

  location.href = "#";
  location.href = "#generate";
}

const parseOptionalSeed = (input) => {
  if (!input || input.value === "") {
    return null;
  }

  const parsed = parseInt(input.value, 10);
  if (Number.isNaN(parsed)) {
    input.value = "";
    return null;
  }

  return parsed;
};

async function renderOrganicMaze(settings) {
  const canvas = document.getElementById("maze");
  if (!canvas) {
    return;
  }

  const solveButton = document.getElementById("solve");
  if (solveButton && !solveButton.classList.contains("hide")) {
    solveButton.classList.add("hide");
  }

  const width = parseNumberInput(organicWidthInput, 800, 10, 4000, {
    isFloat: true,
  });
  const height = parseNumberInput(organicHeightInput, 600, 10, 4000, {
    isFloat: true,
  });
  const numPoints = parseNumberInput(organicPointInput, 200, 3, 5000, {
    isFloat: false,
  });
  const jitterMagnitude = parseNumberInput(organicJitterInput, 3, 0, 100, {
    isFloat: true,
  });
  const jitterPoints = parseNumberInput(organicJitterPointsInput, 1, 0, 10, {
    isFloat: false,
  });
  const seed = parseOptionalSeed(organicSeedInput);

  const params = new URLSearchParams({
    width: width.toString(),
    height: height.toString(),
    num_points: numPoints.toString(),
    algorithm: organicAlgorithmInput
      ? organicAlgorithmInput.value
      : "kruskal",
    jitter_magnitude: jitterMagnitude.toString(),
    jitter_points: jitterPoints.toString(),
  });
  if (seed !== null) {
    params.set("seed", seed.toString());
  }

  try {
    const response = await fetch(`/generate-organic-maze?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok || payload.error) {
      const message = payload && payload.error ? payload.error : response.statusText;
      alert(`Unable to generate organic maze: ${message}`);
      return;
    }

    drawOrganicMaze(canvas, payload, settings);

    if (download && download.classList.contains("hide")) {
      download.classList.remove("hide");
    }
    mazeNodes = { matrix: [[0]] };
    lastMazeType = "organic";
    location.href = "#";
    location.href = "#generate";
    return;
  } catch (error) {
    alert(
      "Failed to reach the organic maze service. Please ensure the Flask server is running."
    );
    console.error(error);
  }
}

function drawOrganicMaze(canvas, layout, settings) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  canvas.width = layout.width;
  canvas.height = layout.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = settings.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = settings.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const baseThickness = Math.max(1, settings.wallSize || 1);
  const minThickness = settings.randomizeWalls
    ? Math.max(1, settings.wallRandomMin || baseThickness)
    : baseThickness;
  const maxThickness = settings.randomizeWalls
    ? Math.max(minThickness, settings.wallRandomMax || minThickness)
    : baseThickness;

  const getThickness = () => {
    if (!settings.randomizeWalls) {
      return baseThickness;
    }
    if (minThickness === maxThickness) {
      return minThickness;
    }
    return minThickness + Math.random() * (maxThickness - minThickness);
  };

  const walls = Array.isArray(layout.walls) ? layout.walls : [];
  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const segments = [];
    if (wall && wall.start) {
      segments.push(wall.start);
    }
    if (wall && Array.isArray(wall.points_intermediate)) {
      for (let j = 0; j < wall.points_intermediate.length; j++) {
        segments.push(wall.points_intermediate[j]);
      }
    }
    if (wall && wall.end) {
      segments.push(wall.end);
    }

    if (segments.length < 2) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(segments[0].x, segments[0].y);
    for (let k = 1; k < segments.length; k++) {
      ctx.lineTo(segments[k].x, segments[k].y);
    }
    ctx.lineWidth = getThickness();
    ctx.stroke();
  }
}

function downloadImage(e) {
  const image = document.getElementById("maze").toDataURL("image/png");
  image.replace("image/png", "image/octet-stream");
  download.setAttribute("href", image);
}

function initSolve() {
  if (lastMazeType !== "grid") {
    alert("Solving is only available for grid-based mazes.");
    return;
  }

  const solveButton = document.getElementById("solve");
  if (solveButton) {
    solveButton.classList.toggle("hide");
  }

  download.setAttribute("download", "maze-solved.png");
  download.innerHTML = "download solved maze";

  if (typeof mazeNodes.matrix === "undefined" || !mazeNodes.matrix.length) {
    return;
  }

  const solver = new Solver(mazeNodes);
  solver.solve();
  if (mazeNodes.wallsRemoved) {
    solver.drawAstarSolve();
  } else {
    solver.draw();
  }

  mazeNodes = {};
}
