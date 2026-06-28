# The Inference Chronicles: Amnesia of an AI Architect 🤖🔮

A text-based, story-driven D&D-style WebGL game where you assume the role of an amnesiac AI engineer trying to escape a simulation representing a Transformer model architecture. To break free, you must navigate through the six fundamental gates of a Transformer network, utilizing your understanding of machine learning concepts to solve puzzles, face gatekeepers, and bypass architectural bottlenecks.

---

## 🌌 The Premise

You wake up inside the **Tensor Void**—a simulated reality that mirrors the inside of a massive Large Language Model. Your memory is corrupted, save for your deep knowledge of neural network architectures. A series of gatekeepers and bottleneck entities guard the pathway to compilation and escape. Only by reasoning through the steps of a model's forward pass can you reconstruct your identity and escape the simulation.

---

## 🚦 The Six Gates of the Transformer

To escape, you must successfully progress through the pipeline:

1. **Embedding Gate (Tokenization & Vector Space)**: Translate your physical presence and raw inputs into dense semantic vector representations.
2. **Positional Encoding Gate**: Restore the order of time and space in the sequence, ensuring the network understands relative and absolute positions.
3. **Attention Gate (Multi-Head Self-Attention)**: Solve key-query-value routing to focus on what matters and prevent quadratic context-window collapse.
4. **Activation Gate (FFN / Feed-Forward & MLP)**: Navigate non-linear projections to resolve complex decision boundaries.
5. **Normalization Gate (LayerNorm / RMSNorm)**: Stabilize internal gradients and scale activations to prevent exploding values.
6. **Inference Gate (Generation & Decoding)**: Complete the final forward pass to output your consciousness back into the physical world.

---

## 🛠️ Features

- **Story-driven D&D Logic**: Rich narration with typewriter effects, character speech bubbles, and branching choice-based paths.
- **WebGL Visuals**: A neon-grid digital aesthetic with custom WebGL animations representing information processing in real-time.
- **Persistent State**: Automated progress saving using browser-based IndexedDB so you can resume your escape at any time.
- **Zero Dependencies**: Lightweight, built using vanilla HTML5, CSS3, JavaScript, and WebGL.
- **Transformer Pipeline Progress Map**: A dynamic visual tracker showing your active position in the model's processing lifecycle.

---

## 🚀 How to Run the Game Locally

### 1. Serve the Files
Since the game loads a local story configuration (`story.json`) and uses standard ES modules/Canvas context, it needs to be run using a local web server to avoid CORS policy blocks.

You can serve the game folder `inference-chronicles` using any simple HTTP server. For example:

**Using Python:**
```bash
# Navigate to the game files directory
cd inference-chronicles

# Start a simple HTTP server
python3 -m http.server 8000
```

**Using Node.js (`http-server` or `serve`):**
```bash
cd inference-chronicles
npx http-server -p 8000
```

### 2. Play the Game
Open your web browser and navigate to:
```
http://localhost:8000
```

---

## 📂 Project Structure

```
game/
├── README.md                     # This documentation file
└── inference-chronicles/         # The game source directory
    ├── index.html                # UI Structure & DOM Elements
    ├── style.css                 # Glassmorphic, neon-grid styling
    ├── app.js                    # Core game engine, IndexedDB & story manager
    ├── webgl-renderer.js         # WebGL canvas background & animations
    └── story.json                # Branching story paths & gate logic
```

---

## 🧪 Tech Stack Details

- **Frontend**: Vanilla HTML5 / JavaScript (ES6)
- **Styling**: Modern CSS3 (Glassmorphism, custom animations, custom layouts)
- **Graphics**: WebGL 1.0 (Fragment/Vertex Shaders for matrix & grid rendering)
- **Database**: IndexedDB API (via standard browser storage)
- **Configuration**: JSON-defined state machine for branching narrative paths
