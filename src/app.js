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
const wallVarianceInput = document.getElementById("wall-variance");
const wallVarianceValue = document.getElementById("wall-variance-value");
const removeBorderInput = document.getElementById("remove-border");
const extraExitsInput = document.getElementById("extra-exits");

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
  if (style === "grid") {
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
  wallVarianceInput.disabled = style === "grid";
  updateWallVarianceDisplay();
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

function initMaze() {
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

  location.href = "#";
  location.href = "#generate";
}

function downloadImage(e) {
  const image = document.getElementById("maze").toDataURL("image/png");
  image.replace("image/png", "image/octet-stream");
  download.setAttribute("href", image);
}

function initSolve() {
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
