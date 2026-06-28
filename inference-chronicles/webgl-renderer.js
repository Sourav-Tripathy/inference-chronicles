/**
 * WebGL and Canvas Renderer for ML D&D Game
 * Handles synthwave background shader, particles, and stick figure animations.
 */

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.gl) {
      console.error('WebGL not supported, falling back to 2D canvas if needed');
      return;
    }

    this.particles = [];
    this.startTime = Date.now();
    this.lastTime = Date.now();
    
    // Game state for animation
    this.playerState = 'idle'; // 'idle', 'walk', 'cast', 'hit'
    this.playerActionTimer = 0;
    this.demonState = 'idle'; // 'idle', 'hover', 'cast', 'hit'
    this.demonActionTimer = 0;
    this.demonStyle = 'glitchy'; // 'glitchy', 'time', 'multi-head', 'fire', 'zen', 'giant'
    
    this.flashRed = 0;
    this.flashGreen = 0;
    this.shakeIntensity = 0;

    this.initGL();
    this.initShaders();
    this.initBuffers();
    this.resize();
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  initGL() {
    const gl = this.gl;
    gl.clearColor(0.02, 0.02, 0.05, 1.0); // Very dark blue/indigo
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  initShaders() {
    const gl = this.gl;

    // --- Background Shader ---
    const bgVsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const bgFsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform float u_flashRed;
      uniform float u_flashGreen;
      uniform vec2 u_resolution;

      // Simple pseudo-random hash
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 uv = v_texCoord;
        
        // Center-oriented UV
        vec2 p = uv - 0.5;
        p.x *= u_resolution.x / u_resolution.y;

        // 3D Perspective Grid
        float gridY = 1.0 / (p.y + 0.6); // Perspective divide
        float gridX = p.x * gridY;
        
        // Grid lines
        float lineX = abs(sin(gridX * 10.0 - u_time * 0.5));
        float lineY = abs(sin(gridY * 8.0 - u_time * 2.0));
        
        // Fade grid with distance (vertical coordinate)
        float gridFade = smoothstep(-0.6, 0.2, p.y) * smoothstep(1.0, -0.6, p.y);
        
        // Neo grid color (cyan/purple)
        vec3 gridColor = vec3(0.0, 0.8, 1.0) * (1.0 - smoothstep(0.0, 0.02, lineX));
        gridColor += vec3(0.8, 0.0, 1.0) * (1.0 - smoothstep(0.0, 0.02, lineY));
        gridColor *= gridFade * 0.4;

        // Background gradient
        vec3 bgGrad = mix(vec3(0.02, 0.01, 0.05), vec3(0.07, 0.02, 0.15), uv.y);
        
        // Glowing horizon
        float horizon = smoothstep(0.01, 0.0, abs(p.y + 0.05)) * 0.4;
        bgGrad += vec3(1.0, 0.0, 0.8) * horizon;

        // Combined base color
        vec3 color = bgGrad + gridColor;

        // Add floaty matrix-like particles
        float particleDensity = 25.0;
        vec2 cell = floor(uv * particleDensity);
        vec2 cellOffset = fract(uv * particleDensity) - 0.5;
        float h = hash(cell);
        if (h > 0.96) {
          float speed = 0.5 + h * 0.5;
          float fade = sin(u_time * speed + h * 6.28) * 0.5 + 0.5;
          float r = 0.03 * h;
          if (length(cellOffset) < r) {
            color += vec3(0.0, 1.0, 0.7) * fade * 0.6;
          }
        }

        // Damage/Success screen flashes
        color = mix(color, vec3(1.0, 0.0, 0.0), u_flashRed * 0.4);
        color = mix(color, vec3(0.0, 1.0, 0.3), u_flashGreen * 0.3);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    this.bgProgram = this.createProgram(bgVsSource, bgFsSource);
    this.bgPositionLoc = gl.getAttribLocation(this.bgProgram, 'a_position');
    this.bgTimeLoc = gl.getUniformLocation(this.bgProgram, 'u_time');
    this.bgFlashRedLoc = gl.getUniformLocation(this.bgProgram, 'u_flashRed');
    this.bgFlashGreenLoc = gl.getUniformLocation(this.bgProgram, 'u_flashGreen');
    this.bgResolutionLoc = gl.getUniformLocation(this.bgProgram, 'u_resolution');

    // --- Line / Character Shader ---
    const lineVsSource = `
      attribute vec2 a_position;
      uniform vec2 u_offset;
      uniform vec2 u_scale;
      uniform float u_shake;
      void main() {
        vec2 pos = a_position * u_scale + u_offset;
        pos.x += u_shake;
        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `;

    const lineFsSource = `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }
    `;

    this.lineProgram = this.createProgram(lineVsSource, lineFsSource);
    this.linePositionLoc = gl.getAttribLocation(this.lineProgram, 'a_position');
    this.lineOffsetLoc = gl.getUniformLocation(this.lineProgram, 'u_offset');
    this.lineScaleLoc = gl.getUniformLocation(this.lineProgram, 'u_scale');
    this.lineShakeLoc = gl.getUniformLocation(this.lineProgram, 'u_shake');
    this.lineColorLoc = gl.getUniformLocation(this.lineProgram, 'u_color');
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program));
    }
    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  initBuffers() {
    const gl = this.gl;

    // Full screen quad for background
    const bgVertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]);
    this.bgBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, bgVertices, gl.STATIC_DRAW);

    // Buffers for characters lines
    this.charBuffer = gl.createBuffer();
  }

  setDemonStyle(style) {
    this.demonStyle = style;
  }

  triggerAction(actor, action) {
    if (actor === 'player') {
      this.playerState = action;
      this.playerActionTimer = Date.now();
    } else if (actor === 'demon') {
      this.demonState = action;
      this.demonActionTimer = Date.now();
    }

    if (action === 'hit') {
      this.shakeIntensity = 0.05;
      if (actor === 'player') {
        this.flashRed = 1.0;
      } else {
        this.flashGreen = 1.0;
      }
    } else if (action === 'cast') {
      // Spawn particles
      const count = 30;
      const startX = actor === 'player' ? -0.4 : 0.4;
      const startY = actor === 'player' ? -0.1 : 0.2;
      const targetX = actor === 'player' ? 0.4 : -0.4;
      const targetY = actor === 'player' ? 0.2 : -0.1;
      const color = actor === 'player' ? [0.0, 1.0, 0.8, 1.0] : [1.0, 0.2, 0.4, 1.0];

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: startX + (Math.random() - 0.5) * 0.1,
          y: startY + (Math.random() - 0.5) * 0.1,
          vx: (targetX - startX) * (0.8 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3,
          vy: (targetY - startY) * (0.8 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.03,
          color: color,
          size: 2.0 + Math.random() * 4.0
        });
      }
    }
  }

  updateParticles() {
    const now = Date.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Decay flashes and shake
    this.flashRed = Math.max(0, this.flashRed - dt * 2.0);
    this.flashGreen = Math.max(0, this.flashGreen - dt * 2.0);
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 3.0);

    // Update particle positions
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Reset temporary action states after duration
    if (this.playerState !== 'idle' && Date.now() - this.playerActionTimer > 800) {
      this.playerState = 'idle';
    }
    if (this.demonState !== 'idle' && Date.now() - this.demonActionTimer > 800) {
      this.demonState = 'idle';
    }
  }

  // Draw circle line loop
  getCirclePoints(cx, cy, r, segments = 12) {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(cx + Math.cos(theta) * r, cy + Math.sin(theta) * r);
    }
    return points;
  }

  getPlayerGeometry(time) {
    // Generate lines for the player stick figure
    const points = [];
    
    // Base bobs up and down if idle
    let bob = 0;
    let walkCycle = 0;
    let angleCast = 0;
    let tilt = 0;

    if (this.playerState === 'idle') {
      bob = Math.sin(time * 4) * 0.015;
    } else if (this.playerState === 'walk') {
      bob = Math.abs(Math.sin(time * 12)) * 0.02;
      walkCycle = time * 12;
    } else if (this.playerState === 'cast') {
      bob = Math.sin(time * 6) * 0.01;
      angleCast = Math.PI * 0.4; // Arm raised
    } else if (this.playerState === 'hit') {
      tilt = -0.2; // Recoil back
      bob = -0.05;
    }

    // Joints coordinates relative to origin (0,0)
    const hipX = 0 + tilt * 0.2;
    const hipY = -0.3 + bob;
    
    const chestX = hipX + tilt * 0.1;
    const chestY = hipY + 0.25;

    const headX = chestX + tilt * 0.05;
    const headY = chestY + 0.12;
    const headR = 0.06;

    // Head circle
    const headPoints = this.getCirclePoints(headX, headY, headR, 12);
    for (let i = 0; i < headPoints.length - 2; i += 2) {
      points.push(headPoints[i], headPoints[i+1], headPoints[i+2], headPoints[i+3]);
    }

    // Torso
    points.push(chestX, chestY, hipX, hipY);

    // Shoulders / Arms
    const shoulderLX = chestX - 0.05;
    const shoulderRX = chestX + 0.05;
    const shoulderY = chestY - 0.03;

    // Left Arm (Usually resting or moving)
    let leftHandX = shoulderLX - 0.04;
    let leftHandY = shoulderY - 0.1;
    if (this.playerState === 'walk') {
      leftHandX = shoulderLX + Math.sin(walkCycle) * 0.06;
      leftHandY = shoulderY - 0.08 + Math.cos(walkCycle) * 0.03;
    }
    points.push(shoulderLX, shoulderY, leftHandX, leftHandY);

    // Right Arm (Casting action!)
    let rightHandX = shoulderRX + 0.04;
    let rightHandY = shoulderY - 0.1;
    if (this.playerState === 'cast') {
      // Raise hand towards right top
      rightHandX = shoulderRX + 0.1;
      rightHandY = shoulderY + 0.12 + Math.sin(time * 20) * 0.01;
    } else if (this.playerState === 'walk') {
      rightHandX = shoulderRX - Math.sin(walkCycle) * 0.06;
      rightHandY = shoulderY - 0.08 - Math.cos(walkCycle) * 0.03;
    }
    points.push(shoulderRX, shoulderY, rightHandX, rightHandY);

    // Hips / Legs
    const hipLX = hipX - 0.03;
    const hipRX = hipX + 0.03;

    // Left Leg
    let leftFootX = hipLX - 0.04;
    let leftFootY = -0.55;
    if (this.playerState === 'walk') {
      leftFootX = hipLX + Math.sin(walkCycle) * 0.08;
      leftFootY = -0.55 + Math.max(0, Math.cos(walkCycle)) * 0.04;
    }
    points.push(hipLX, hipY, leftFootX, leftFootY);

    // Right Leg
    let rightFootX = hipRX + 0.04;
    let rightFootY = -0.55;
    if (this.playerState === 'walk') {
      rightFootX = hipRX - Math.sin(walkCycle) * 0.08;
      rightFootY = -0.55 + Math.max(0, -Math.cos(walkCycle)) * 0.04;
    }
    points.push(hipRX, hipY, rightFootX, rightFootY);

    // Ground platform line under player
    points.push(-0.25, -0.57, 0.25, -0.57);
    points.push(-0.18, -0.59, 0.18, -0.59);

    return new Float32Array(points);
  }

  getDemonGeometry(time) {
    const points = [];
    let bob = Math.sin(time * 3) * 0.02;
    let tilt = 0;
    
    if (this.demonState === 'hit') {
      tilt = 0.2;
      bob = 0.03;
    }

    const hipX = 0 + tilt * 0.2;
    const hipY = -0.15 + bob;
    
    const chestX = hipX + tilt * 0.1;
    const chestY = hipY + 0.3;

    // Head / Horns
    const headX = chestX + tilt * 0.05;
    const headY = chestY + 0.15;
    let headR = 0.08;

    // Customize based on Demon Style
    if (this.demonStyle === 'giant') {
      headR = 0.15; // Larger colossus head
    }

    // Head circle/polygon
    const headPoints = this.getCirclePoints(headX, headY, headR, 8);
    for (let i = 0; i < headPoints.length - 2; i += 2) {
      points.push(headPoints[i], headPoints[i+1], headPoints[i+2], headPoints[i+3]);
    }

    // Horns
    if (this.demonStyle === 'glitchy' || this.demonStyle === 'fire' || this.demonStyle === 'multi-head' || this.demonStyle === 'giant') {
      // Left horn
      points.push(headX - headR * 0.5, headY + headR * 0.8, headX - headR * 0.9, headY + headR * 1.5);
      points.push(headX - headR * 0.9, headY + headR * 1.5, headX - headR * 0.4, headY + headR * 1.3);
      // Right horn
      points.push(headX + headR * 0.5, headY + headR * 0.8, headX + headR * 0.9, headY + headR * 1.5);
      points.push(headX + headR * 0.9, headY + headR * 1.5, headX + headR * 0.4, headY + headR * 1.3);
    }

    // Torso
    points.push(chestX, chestY, hipX, hipY);

    // Multi-heads for Attention Hydra
    if (this.demonStyle === 'multi-head') {
      // Draw 2 extra necks and heads branching from chest
      // Head Left
      const headLX = chestX - 0.12;
      const headLY = chestY + 0.18 + Math.cos(time * 4) * 0.02;
      const headLPoints = this.getCirclePoints(headLX, headLY, 0.05, 6);
      for (let i = 0; i < headLPoints.length - 2; i += 2) {
        points.push(headLPoints[i], headLPoints[i+1], headLPoints[i+2], headLPoints[i+3]);
      }
      points.push(chestX, chestY, headLX, headLY); // Neck

      // Head Right
      const headRX = chestX + 0.12;
      const headRY = chestY + 0.18 + Math.sin(time * 4) * 0.02;
      const headRPoints = this.getCirclePoints(headRX, headRY, 0.05, 6);
      for (let i = 0; i < headRPoints.length - 2; i += 2) {
        points.push(headRPoints[i], headRPoints[i+1], headRPoints[i+2], headRPoints[i+3]);
      }
      points.push(chestX, chestY, headRX, headRY); // Neck
    }

    // Arms
    const shoulderLX = chestX - 0.07;
    const shoulderRX = chestX + 0.07;
    const shoulderY = chestY - 0.05;

    if (this.demonStyle === 'zen') {
      // Floating Guru NaN: Meditating posture (arms crossed or resting on knees)
      points.push(shoulderLX, shoulderY, shoulderLX - 0.05, shoulderY - 0.05);
      points.push(shoulderLX - 0.05, shoulderY - 0.05, hipX - 0.04, hipY + 0.05);
      points.push(shoulderRX, shoulderY, shoulderRX + 0.05, shoulderY - 0.05);
      points.push(shoulderRX + 0.05, shoulderY - 0.05, hipX + 0.04, hipY + 0.05);
    } else {
      // Normal / Attack arms
      let leftHandX = shoulderLX - 0.08;
      let leftHandY = shoulderY - 0.12;
      let rightHandX = shoulderRX + 0.08;
      let rightHandY = shoulderY - 0.12;

      if (this.demonState === 'cast') {
        // Threateningly pointing arms forward
        leftHandX = shoulderLX - 0.15;
        leftHandY = shoulderY + 0.02 + Math.sin(time * 25) * 0.02;
        rightHandX = shoulderRX - 0.05;
        rightHandY = shoulderY - 0.05;
      }
      points.push(shoulderLX, shoulderY, leftHandX, leftHandY);
      points.push(shoulderRX, shoulderY, rightHandX, rightHandY);
    }

    // Lower body (Legs / Floating tail / Platform)
    if (this.demonStyle === 'zen') {
      // Crossed legs (meditation pose)
      points.push(hipX - 0.05, hipY, hipX + 0.05, hipY); // flat lap
      points.push(hipX - 0.05, hipY, hipX - 0.08, hipY - 0.06); // crossed knee left
      points.push(hipX - 0.08, hipY - 0.06, hipX, hipY - 0.06);
      points.push(hipX + 0.05, hipY, hipX + 0.08, hipY - 0.06); // crossed knee right
      points.push(hipX + 0.08, hipY - 0.06, hipX, hipY - 0.06);

      // Glowing rings around Guru
      const ringPoints1 = this.getCirclePoints(hipX, hipY + 0.1, 0.22, 16);
      for (let i = 0; i < ringPoints1.length - 2; i += 2) {
        points.push(ringPoints1[i], ringPoints1[i+1] * 0.2 + (hipY + 0.05), ringPoints1[i+2], ringPoints1[i+3] * 0.2 + (hipY + 0.05));
      }
    } else if (this.demonStyle === 'time') {
      // Clock arms legs!
      points.push(hipX - 0.04, hipY, hipX - 0.08, hipY - 0.15);
      points.push(hipX + 0.04, hipY, hipX + 0.08, hipY - 0.15);
      
      // Giant clock face behind chest
      const clockPoints = this.getCirclePoints(chestX, chestY, 0.2, 16);
      for (let i = 0; i < clockPoints.length - 2; i += 2) {
        points.push(clockPoints[i], clockPoints[i+1], clockPoints[i+2], clockPoints[i+3]);
      }
      // Clock hands
      const angleHour = time * 0.5;
      const angleMin = time * 3.0;
      points.push(chestX, chestY, chestX + Math.cos(angleHour) * 0.12, chestY + Math.sin(angleHour) * 0.12);
      points.push(chestX, chestY, chestX + Math.cos(angleMin) * 0.16, chestY + Math.sin(angleMin) * 0.16);
    } else if (this.demonStyle === 'giant') {
      // Colossus has thick legs standing firmly
      points.push(hipX - 0.08, hipY, hipX - 0.15, -0.57);
      points.push(hipX + 0.08, hipY, hipX + 0.15, -0.57);
      
      // Ground platform line under Colossus
      points.push(0.2, -0.57, 0.8, -0.57);
      points.push(0.25, -0.59, 0.75, -0.59);
    } else {
      // Standard demon has floating tail/tentacles
      const tailPoints = [];
      const segs = 6;
      let curX = hipX;
      let curY = hipY;
      for (let i = 0; i < segs; i++) {
        const nextX = hipX + Math.sin(time * 4 + i * 0.8) * 0.05 - 0.02 * i;
        const nextY = hipY - 0.07 * i;
        tailPoints.push(curX, curY, nextX, nextY);
        curX = nextX;
        curY = nextY;
      }
      points.push(...tailPoints);

      // Floating pedestal
      points.push(0.3, -0.5, 0.7, -0.5);
      points.push(0.35, -0.52, 0.65, -0.52);
      points.push(0.4, -0.54, 0.6, -0.54);
    }

    // Wings (For fire and standard demon)
    if (this.demonStyle === 'fire' || this.demonStyle === 'glitchy') {
      const wingSway = Math.sin(time * 3.5) * 0.04;
      // Left Wing
      points.push(chestX - 0.05, chestY, chestX - 0.25, chestY + 0.18 + wingSway);
      points.push(chestX - 0.25, chestY + 0.18 + wingSway, chestX - 0.18, chestY - 0.05);
      points.push(chestX - 0.18, chestY - 0.05, chestX - 0.05, chestY);
      // Right Wing
      points.push(chestX + 0.05, chestY, chestX + 0.25, chestY + 0.18 - wingSway);
      points.push(chestX + 0.25, chestY + 0.18 - wingSway, chestX + 0.18, chestY - 0.05);
      points.push(chestX + 0.18, chestY - 0.05, chestX + 0.05, chestY);
    }

    return new Float32Array(points);
  }

  draw() {
    const gl = this.gl;
    if (!gl) return;

    this.resize();
    this.updateParticles();

    // 1. Draw Background Shader
    gl.useProgram(this.bgProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuffer);
    gl.enableVertexAttribArray(this.bgPositionLoc);
    gl.vertexAttribPointer(this.bgPositionLoc, 2, gl.FLOAT, false, 0, 0);

    const time = (Date.now() - this.startTime) / 1000;
    gl.uniform1f(this.bgTimeLoc, time);
    gl.uniform1f(this.bgFlashRedLoc, this.flashRed);
    gl.uniform1f(this.bgFlashGreenLoc, this.flashGreen);
    gl.uniform2f(this.bgResolutionLoc, this.canvas.width, this.canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Draw Characters
    gl.useProgram(this.lineProgram);
    
    // Set line thickness if supported (limited fallback)
    // We'll draw several lines overlayed or slightly offset to simulate thick glowing vectors.
    const shake = (Math.random() - 0.5) * this.shakeIntensity;
    gl.uniform1f(this.lineShakeLoc, shake);

    const drawLineMesh = (vertices, color, offset, scale) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.charBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.linePositionLoc);
      gl.vertexAttribPointer(this.linePositionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2fv(this.lineOffsetLoc, offset);
      gl.uniform2fv(this.lineScaleLoc, scale);
      
      // Draw glow pass 1 (thicker, translucent)
      gl.uniform4f(this.lineColorLoc, color[0], color[1], color[2], color[3] * 0.4);
      gl.drawArrays(gl.LINES, 0, vertices.length / 2);
      
      // Draw center pass (solid/white center)
      gl.uniform4f(this.lineColorLoc, 1.0, 1.0, 1.0, color[3]);
      gl.drawArrays(gl.LINES, 0, vertices.length / 2);
    };

    // Draw Player
    const playerGeo = this.getPlayerGeometry(time);
    let playerColor = [0.0, 1.0, 0.8, 1.0]; // Neon green/cyan
    if (this.playerState === 'hit') {
      playerColor = [1.0, 0.2, 0.2, 1.0]; // Flash Red
    }
    // Player translation and scale
    drawLineMesh(playerGeo, playerColor, [-0.4, 0.0], [1.0, 1.0]);

    // Draw Demon
    const demonGeo = this.getDemonGeometry(time);
    let demonColor = [1.0, 0.0, 0.5, 1.0]; // Hot pink
    if (this.demonState === 'hit') {
      demonColor = [0.2, 1.0, 0.2, 1.0]; // Flash Green on hit
    } else if (this.demonStyle === 'zen') {
      demonColor = [0.9, 0.9, 0.2, 1.0]; // Golden/Zen
    } else if (this.demonStyle === 'time') {
      demonColor = [0.4, 0.7, 1.0, 1.0]; // Ice blue
    } else if (this.demonStyle === 'fire') {
      demonColor = [1.0, 0.3, 0.0, 1.0]; // Molten orange
    } else if (this.demonStyle === 'giant') {
      demonColor = [0.6, 0.3, 1.0, 1.0]; // Heavy purple
    }

    // Apply scaling or offsets depending on the demon size
    const demonScale = this.demonStyle === 'giant' ? [1.4, 1.4] : [1.0, 1.0];
    const demonOffset = this.demonStyle === 'giant' ? [0.4, -0.15] : [0.4, 0.0];

    // Glitch effect for Tokenizer Demon
    if (this.demonStyle === 'glitchy' && Math.random() > 0.94) {
      demonOffset[0] += (Math.random() - 0.5) * 0.05;
      demonOffset[1] += (Math.random() - 0.5) * 0.05;
    }

    drawLineMesh(demonGeo, demonColor, demonOffset, demonScale);

    // 3. Draw Particles (using line shader, drawn as tiny square segments)
    if (this.particles.length > 0) {
      const partVertices = [];
      for (const p of this.particles) {
        partVertices.push(
          p.x - 0.01, p.y, p.x + 0.01, p.y,
          p.x, p.y - 0.01, p.x, p.y + 0.01
        );
      }
      
      gl.bindBuffer(gl.ARRAY_BUFFER, this.charBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(partVertices), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.linePositionLoc);
      gl.vertexAttribPointer(this.linePositionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2fv(this.lineOffsetLoc, [0.0, 0.0]);
      gl.uniform2fv(this.lineScaleLoc, [1.0, 1.0]);

      // Draw particle groups
      let idx = 0;
      for (const p of this.particles) {
        gl.uniform4f(this.lineColorLoc, p.color[0], p.color[1], p.color[2], p.life);
        gl.drawArrays(gl.LINES, idx * 4, 4);
        idx++;
      }
    }

    // Loop
    requestAnimationFrame(() => this.draw());
  }
}

// Attach renderer class to window
window.GameRenderer = GameRenderer;
