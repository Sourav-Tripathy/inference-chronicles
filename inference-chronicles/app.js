/**
 * Main application script for the ML D&D game
 * Manages state transition, IndexedDB progress, dialogue bubble flow, and map routing.
 * Supports multiple maps/chapters.
 */

// Global state
let gameData = null;
let currentMapIndex = 0;
let currentGateIndex = 0;
let playerStats = {
  id: "player_save",
  name: "AI Engineer",
  intellect: 0,
  warnings: [],
  choiceHistory: {},
  currentMap: 0,
  currentGate: 0,
  isIntroSeen: false
};
let db = null;
let renderer = null;

// IndexedDB Helper Functions
const DB_NAME = 'ML_DND_Database';
const STORE_NAME = 'player_data';

function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };
    request.onerror = (event) => {
      console.error("Database open error:", event.target.error);
      reject(event.target.error);
    };
  });
}

function saveProgress() {
  if (!db) return;
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.put(playerStats);
}

function loadProgress() {
  return new Promise((resolve) => {
    if (!db) {
      resolve(null);
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("player_save");
    request.onsuccess = (event) => {
      resolve(event.target.result || null);
    };
    request.onerror = () => {
      resolve(null);
    };
  });
}

function deleteProgress() {
  if (!db) return;
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.delete("player_save");
}

// Load Story JSON
async function loadStory() {
  try {
    const response = await fetch('story.json');
    gameData = await response.json();
  } catch (error) {
    console.error("Failed to load story data:", error);
  }
}

// Typewriter effect helper
let typeInterval = null;
function typeWriter(elementId, text, speed = 20, callback = null) {
  if (typeInterval) clearInterval(typeInterval);
  const element = document.getElementById(elementId);
  element.innerHTML = "";
  let i = 0;
  typeInterval = setInterval(() => {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
    } else {
      clearInterval(typeInterval);
      if (callback) callback();
    }
  }, speed);
}

// Speech Bubble Management
function showBubble(actor, text, callback = null) {
  const pBubble = document.getElementById('player-bubble');
  const dBubble = document.getElementById('demon-bubble');

  if (actor === 'player') {
    pBubble.style.display = 'block';
    dBubble.style.display = 'none';
    typeWriter('player-bubble-text', text, 15, callback);
  } else if (actor === 'demon') {
    dBubble.style.display = 'block';
    pBubble.style.display = 'none';
    typeWriter('demon-bubble-text', text, 15, callback);
  } else {
    pBubble.style.display = 'none';
    dBubble.style.display = 'none';
    if (callback) callback();
  }
}

// Render Stats UI
function updateStatsUI() {
  document.getElementById('stat-intellect').innerText = playerStats.intellect;
  
  // Show active map title in player profile
  if (gameData && gameData.maps[currentMapIndex]) {
    document.getElementById('player-profile-name').innerText = gameData.maps[currentMapIndex].title;
  }

  const warningList = document.getElementById('warning-list');
  warningList.innerHTML = '';
  
  if (playerStats.warnings.length === 0) {
    warningList.innerHTML = '<span class="status-good">No active bottlenecks</span>';
  } else {
    playerStats.warnings.forEach(warn => {
      const span = document.createElement('span');
      span.className = 'status-warning';
      span.innerText = `⚠ ${warn}`;
      warningList.appendChild(span);
    });
  }
}

// Render the active map progress pipeline
function updateMapUI() {
  if (!gameData || !gameData.maps[currentMapIndex]) return;
  const mapContainer = document.getElementById('map-pipeline');
  mapContainer.innerHTML = '';

  const activeMap = gameData.maps[currentMapIndex];

  activeMap.gates.forEach((gate, index) => {
    const node = document.createElement('div');
    node.className = 'pipeline-node';
    
    // Status color classes
    if (index < currentGateIndex) {
      node.classList.add('completed');
    } else if (index === currentGateIndex) {
      node.classList.add('active');
    } else {
      node.classList.add('locked');
    }

    // Shorten name for the map nodes
    let shortName = gate.name.split(' ')[0] || gate.name;
    if (shortName.toLowerCase() === 'the') {
      shortName = gate.name.split(' ')[1] || gate.name;
    }

    node.innerHTML = `
      <div class="node-icon">${index + 1}</div>
      <div class="node-name">${shortName}</div>
    `;

    mapContainer.appendChild(node);

    // Draw connection lines except for the last one
    if (index < activeMap.gates.length - 1) {
      const line = document.createElement('div');
      line.className = 'pipeline-line';
      if (index < currentGateIndex) {
        line.classList.add('completed');
      }
      mapContainer.appendChild(line);
    }
  });
}

// Game State Machine
async function initGame() {
  await initDatabase();
  await loadStory();

  const savedState = await loadProgress();
  if (savedState) {
    playerStats = savedState;
    currentMapIndex = playerStats.currentMap || 0;
    currentGateIndex = playerStats.currentGate || 0;
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'grid';
    initRenderer();
    loadGate(currentMapIndex, currentGateIndex);
  } else {
    showTitleScreen();
  }
}

function showTitleScreen() {
  document.getElementById('title-screen').style.display = 'flex';
  document.getElementById('game-screen').style.display = 'none';
  typeWriter('title-intro-text', 'SYS_INIT: Accessing forgotten neural pathways...\nMEMORY STATUS: Lost\nMISSION: Escape the Tensor Void.', 30);
}

function startNewGame() {
  deleteProgress();
  playerStats = {
    id: "player_save",
    name: "AI Engineer",
    intellect: 0,
    warnings: [],
    choiceHistory: {},
    currentMap: 0,
    currentGate: 0,
    isIntroSeen: false
  };
  currentMapIndex = 0;
  currentGateIndex = 0;
  
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'grid';
  
  initRenderer();
  saveProgress();
  
  triggerIntroStory();
}

function initRenderer() {
  const canvas = document.getElementById('webgl-canvas');
  renderer = new GameRenderer(canvas);
  renderer.draw(); // Starts the rendering loop
}

function triggerIntroStory() {
  document.getElementById('player-bubble').style.display = 'none';
  document.getElementById('demon-bubble').style.display = 'none';
  document.getElementById('options-container').innerHTML = '';
  updateMapUI();
  updateStatsUI();
  
  const introText = "You wake up. Your head is pounding with matrix multiplications. You are trapped in a glowing neon grid. The memory of your name is gone, replaced with mathematical abstractions. You realize you are inside a Transformer pipeline. To escape, you must rebuild the model gates from ground up, using your raw AI intellect. An ominous rumbling signals the first gate's sentinel.";
  
  typeWriter('narration-text', introText, 15, () => {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'comic-btn';
    nextBtn.innerText = 'Step into the Abyss ->';
    nextBtn.onclick = () => {
      playerStats.isIntroSeen = true;
      saveProgress();
      loadGate(currentMapIndex, currentGateIndex);
    };
    document.getElementById('options-container').appendChild(nextBtn);
  });
}

function loadGate(mapIdx, gateIdx) {
  if (!gameData) return;
  
  if (mapIdx >= gameData.maps.length) {
    triggerVictory();
    return;
  }

  const mapData = gameData.maps[mapIdx];
  if (gateIdx >= mapData.gates.length) {
    triggerMapTransition(mapIdx + 1);
    return;
  }

  document.getElementById('player-bubble').style.display = 'none';
  document.getElementById('demon-bubble').style.display = 'none';
  
  currentMapIndex = mapIdx;
  currentGateIndex = gateIdx;
  playerStats.currentMap = mapIdx;
  playerStats.currentGate = gateIdx;
  saveProgress();

  updateStatsUI();
  updateMapUI();

  const gate = mapData.gates[gateIdx];
  renderer.setDemonStyle(gate.demonStyle);

  // Set scene title overlay
  document.getElementById('current-gate-name').innerText = gate.name;
  document.getElementById('current-gate-subtitle').innerText = gate.subtitle;

  // Animate the player walking into the frame
  renderer.triggerAction('player', 'walk');
  
  const gateIntroText = gate.description;
  typeWriter('narration-text', gateIntroText, 15, () => {
    const meetBtn = document.createElement('button');
    meetBtn.className = 'comic-btn';
    meetBtn.innerText = `Confront the ${gate.demonName}`;
    meetBtn.onclick = () => {
      triggerDemonQuestion(gate);
    };
    document.getElementById('options-container').innerHTML = '';
    document.getElementById('options-container').appendChild(meetBtn);
  });
}

function triggerDemonQuestion(gate) {
  renderer.triggerAction('demon', 'cast');
  
  showBubble('demon', `HALT! I am the ${gate.demonName}. ${gate.question}`, () => {
    displayChoices(gate);
  });
}

function displayChoices(gate) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  gate.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'comic-btn choice-btn';
    btn.innerHTML = `<span class="choice-tag">▶</span> ${opt.text}`;
    btn.onclick = () => {
      evaluateChoice(gate, opt);
    };
    container.appendChild(btn);
  });
}

function evaluateChoice(gate, option) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  document.getElementById('player-bubble').style.display = 'none';
  document.getElementById('demon-bubble').style.display = 'none';

  playerStats.choiceHistory[gate.id] = option.id;

  if (option.outcome === 'success') {
    renderer.triggerAction('player', 'cast');
    
    setTimeout(() => {
      renderer.triggerAction('demon', 'hit');
      
      showBubble('player', "I apply my AI intellect! Take this mathematical proof!", () => {
        typeWriter('narration-text', option.message, 15, () => {
          playerStats.intellect += option.intellectReward;
          
          const nextBtn = document.createElement('button');
          nextBtn.className = 'comic-btn';
          nextBtn.innerText = 'Advance to the Next Gate ->';
          nextBtn.onclick = () => {
            loadGate(currentMapIndex, currentGateIndex + 1);
          };
          container.appendChild(nextBtn);
          updateStatsUI();
          saveProgress();
        });
      });
    }, 600);

  } else if (option.outcome === 'suboptimal') {
    renderer.triggerAction('player', 'cast');
    
    setTimeout(() => {
      renderer.triggerAction('demon', 'idle');
      
      showBubble('demon', "Acceptable... but sub-optimal. Your system will carry a bottleneck.", () => {
        typeWriter('narration-text', option.message, 15, () => {
          playerStats.intellect += option.intellectReward;
          if (option.warning && !playerStats.warnings.includes(option.warning)) {
            playerStats.warnings.push(option.warning);
          }

          const nextBtn = document.createElement('button');
          nextBtn.className = 'comic-btn';
          nextBtn.innerText = 'Limp Forward ->';
          nextBtn.onclick = () => {
            loadGate(currentMapIndex, currentGateIndex + 1);
          };
          container.appendChild(nextBtn);
          updateStatsUI();
          saveProgress();
        });
      });
    }, 600);

  } else {
    renderer.triggerAction('demon', 'cast');

    setTimeout(() => {
      renderer.triggerAction('player', 'hit');

      showBubble('demon', "WRONG PARADIGM! Crushing your weights!", () => {
        typeWriter('narration-text', option.message, 15, () => {
          const retryBtn = document.createElement('button');
          retryBtn.className = 'comic-btn retry-btn';
          retryBtn.innerText = '⚠ Recompile and Try Again ⚠';
          retryBtn.onclick = () => {
            loadGate(currentMapIndex, currentGateIndex);
          };
          container.appendChild(retryBtn);
        });
      });
    }, 600);
  }
}

function triggerMapTransition(nextMapIdx) {
  document.getElementById('player-bubble').style.display = 'none';
  document.getElementById('demon-bubble').style.display = 'none';
  document.getElementById('options-container').innerHTML = '';

  if (nextMapIdx >= gameData.maps.length) {
    triggerVictory();
    return;
  }

  const currentMap = gameData.maps[currentMapIndex];
  const nextMap = gameData.maps[nextMapIdx];
  
  const transitionText = `MAP COMPLETE!\n\nYou have successfully completed ${currentMap.title}.\n\nYour AI intellect grows stronger, but your journey is far from over. Next, you must enter ${nextMap.title} (${nextMap.subtitle}). Prepare yourself for the next set of challenges...`;
  
  // Set transition titles
  document.getElementById('current-gate-name').innerText = "MAP TRANSITION";
  document.getElementById('current-gate-subtitle').innerText = `Entering Map ${nextMapIdx + 1}`;

  typeWriter('narration-text', transitionText, 15, () => {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'comic-btn primary-glow';
    nextBtn.innerText = `Enter ${nextMap.title} ->`;
    nextBtn.onclick = () => {
      loadGate(nextMapIdx, 0);
    };
    document.getElementById('options-container').appendChild(nextBtn);
  });
}

function triggerVictory() {
  document.getElementById('player-bubble').style.display = 'none';
  document.getElementById('demon-bubble').style.display = 'none';
  document.getElementById('options-container').innerHTML = '';
  document.getElementById('current-gate-name').innerText = "SYSTEM INFERENCE: ONLINE";
  document.getElementById('current-gate-subtitle').innerText = "All Maps completed";

  let finalMessage = "";
  if (playerStats.warnings.length === 0) {
    finalMessage = "INCREDIBLE! You designed a flawless, optimized Transformer pipeline. Zero training or hardware memory bottlenecks, optimal activation functions, balanced learning rates, and highly compressed weights. You deploy the 8B model seamlessly to the cloud. As the inference loads run at lightning speed, your memory rushes back. You are Sourav, the Ultimate AI Architect! The grid fades away as you log out of the simulator, ready to build the next generation of intelligence.";
  } else {
    finalMessage = `Model deployed, but with ${playerStats.warnings.length} active bottleneck(s). Your model struggles under heavy load due to your decisions (${playerStats.warnings.join(', ')}). Convergence is jagged, VRAM latency spikes, but the output eventually generates. Your memories slowly reconstruct: you are an AI Engineer who survived the Tensor Void simulator. You have passed, but your architecture has room for optimization. Next time, aim for a clean run!`;
  }

  typeWriter('narration-text', finalMessage, 15, () => {
    const container = document.getElementById('options-container');
    const tableDiv = document.createElement('div');
    tableDiv.className = 'victory-results';
    tableDiv.innerHTML = `
      <h3>Final Assessment</h3>
      <table class="assessment-table">
        <tr><td>AI Intellect:</td><td class="val">${playerStats.intellect} pts</td></tr>
        <tr><td>Active Bottlenecks:</td><td class="val">${playerStats.warnings.length}</td></tr>
        <tr><td>Deploy Status:</td><td class="val status-good">${playerStats.warnings.length === 0 ? "EXCELLENT" : "STABLE BUT DEGRADED"}</td></tr>
      </table>
    `;
    container.appendChild(tableDiv);

    const restartBtn = document.createElement('button');
    restartBtn.className = 'comic-btn';
    restartBtn.innerText = 'Start a New Journey';
    restartBtn.onclick = () => {
      startNewGame();
    };
    container.appendChild(restartBtn);

    deleteProgress();
  });
}

// Bind load event
window.onload = () => {
  initGame();
};
