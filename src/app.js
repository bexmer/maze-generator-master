// Global variables
let mazeNodes = {};

const wallSizeInput = document.getElementById("wall-size");
const wallSizeValue = document.getElementById("wall-size-value");
const passageSizeInput = document.getElementById("passage-size");
const passageSizeValue = document.getElementById("passage-size-value");
const randomizePassageInput = document.getElementById("randomize-passage");
const passageRangeMinInput = document.getElementById("passage-size-min");
const passageRangeMaxInput = document.getElementById("passage-size-max");
const removeBorderInput = document.getElementById("remove-border");
const extraExitsInput = document.getElementById("extra-exits");

const passageSliderMin = passageSizeInput
  ? Math.max(1, parseInt(passageSizeInput.min, 10) || 1)
  : 1;
const passageSliderMax = passageSizeInput
  ? Math.max(passageSliderMin, parseInt(passageSizeInput.max, 10) || passageSliderMin)
  : passageSliderMin;

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

const getPassageRandomRange = () => {
  const minValue = parseBoundedInt(
    passageRangeMinInput,
    passageSliderMin,
    passageSliderMin,
    passageSliderMax
  );
  let maxValue = parseBoundedInt(
    passageRangeMaxInput,
    passageSliderMax,
    passageSliderMin,
    passageSliderMax
  );

  if (maxValue < minValue) {
    maxValue = minValue;
    if (passageRangeMaxInput) {
      passageRangeMaxInput.value = maxValue;
    }
  }

  return { min: minValue, max: maxValue };
};

const syncPassageSliderEnabledState = () => {
  if (passageSizeInput) {
    passageSizeInput.disabled = !!(randomizePassageInput && randomizePassageInput.checked);
  }
};

const updatePassageDisplay = ({ range } = {}) => {
  if (!passageSizeValue) {
    return;
  }

  const randomize = !!(randomizePassageInput && randomizePassageInput.checked);
  if (randomize) {
    const activeRange = range || getPassageRandomRange();
    passageSizeValue.textContent = `Random (${activeRange.min}-${activeRange.max} px)`;
  } else if (passageSizeInput) {
    passageSizeValue.textContent = `${passageSizeInput.value} px`;
  }
};

if (wallSizeInput && wallSizeValue) {
  const updateWallSizeDisplay = () => {
    wallSizeValue.textContent = `${wallSizeInput.value} px`;
  };

  updateWallSizeDisplay();

  wallSizeInput.addEventListener("input", () => {
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
    if (randomizePassageInput && randomizePassageInput.checked) {
      updatePassageDisplay();
      return;
    }

    updatePassageDisplay();

    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

const onRandomRangeInput = () => {
  getPassageRandomRange();
  updatePassageDisplay();

  if (
    randomizePassageInput &&
    randomizePassageInput.checked &&
    mazeNodes.matrix &&
    mazeNodes.matrix.length
  ) {
    initMaze();
  }
};

if (randomizePassageInput) {
  randomizePassageInput.addEventListener("change", () => {
    syncPassageSliderEnabledState();
    updatePassageDisplay();

    if (mazeNodes.matrix && mazeNodes.matrix.length) {
      initMaze();
    }
  });
}

if (passageRangeMinInput) {
  passageRangeMinInput.addEventListener("input", onRandomRangeInput);
}

if (passageRangeMaxInput) {
  passageRangeMaxInput.addEventListener("input", onRandomRangeInput);
}

syncPassageSliderEnabledState();
if (randomizePassageInput && randomizePassageInput.checked) {
  getPassageRandomRange();
}
updatePassageDisplay();

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

  const randomizePassages = !!(randomizePassageInput && randomizePassageInput.checked);
  let passageRange = null;
  if (randomizePassages) {
    passageRange = getPassageRandomRange();
    updatePassageDisplay({ range: passageRange });
  } else {
    updatePassageDisplay();
  }

  const settings = {
    width,
    height,
    wallSize,
    passageSize: basePassageSize,
    removeWalls,
    removeOuterBorder: removeBorderInput ? removeBorderInput.checked : false,
    extraExits,
    randomizePassages,
    passageRandomMin: passageRange ? passageRange.min : undefined,
    passageRandomMax: passageRange ? passageRange.max : undefined,
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
