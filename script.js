const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
  alert(
    "Unable to initialize WebGL. Your browser or machine may not support it."
  );
}

const vertexShaderSource = `
    attribute vec4 aVertexPosition;
    void main() {
        gl_Position = aVertexPosition;
    }
`;

const fragmentShaderSource = `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform vec4 uColor1;
    uniform vec4 uColor2;
    uniform vec4 uColor3;
    uniform float uSpinAmount;
    uniform float uContrast;
    uniform float uTurbulence;
    uniform float uSwirliness;

    #define PIXEL_SIZE_FAC 700.0
    #define SPIN_EASE 0.5

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
         //Convert to UV coords (0-1) and floor for pixel effect
        float pixel_size = length(iResolution.xy)/PIXEL_SIZE_FAC;
        vec2 uv = (floor(fragCoord.xy*(1.0/pixel_size))*pixel_size - 0.5*iResolution.xy)/length(iResolution.xy) - vec2(0.0, 0.0);
        float uv_len = length(uv);

        //Adding in a center swirl, changes with iTime. Only applies meaningfully if the 'spin amount' is a non-zero number
        float speed = (iTime*SPIN_EASE*0.1*uSwirliness) + 302.2;
        float new_pixel_angle = (atan(uv.y, uv.x)) + speed - SPIN_EASE*20.*(1.*uSpinAmount*uv_len + (1. - 1.*uSpinAmount));
        vec2 mid = (iResolution.xy/length(iResolution.xy))/2.;
        uv = (vec2((uv_len * cos(new_pixel_angle) + mid.x), (uv_len * sin(new_pixel_angle) + mid.y)) - mid);

        //Now add the paint effect to the swirled UV
        uv *= 30.;
        speed = iTime*(1.);
        vec2 uv2 = vec2(uv.x+uv.y);

        for(int i=0; i < 3; i++) {
            uv2 += uv + cos(length(uv));
            uv  += 0.5*vec2(cos(5.1123314 + 0.353*uv2.y + speed*0.131121),sin(uv2.x - 0.113*speed));
            uv  -= 1.0*cos(uv.x + uv.y) - 1.0*sin(uv.x*0.711 - uv.y);
        }

        //Make the paint amount range from 0 - 2
        float contrast_mod = (0.25*uContrast + 0.5*uSpinAmount + 1.2);
        float paint_res =min(2., max(0.,length(uv)*(0.035)*contrast_mod));
        float c1p = max(0.,1. - contrast_mod*abs(1.-paint_res));
        float c2p = max(0.,1. - contrast_mod*abs(paint_res));
        float c3p = 1. - min(1., c1p + c2p);

        vec4 ret_col = (0.3/uContrast)*uColor1 + (1. - 0.3/uContrast)*(uColor1*c1p + uColor2*c2p + vec4(c3p*uColor3.rgb, c3p*uColor1.a)) + 0.3*max(c1p*5. - 4., 0.) + 0.4*max(c2p*5. - 4., 0.);

        fragColor = ret_col;
    }

    void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
    }
`;

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
    return null;
  }

  return shaderProgram;
}

const shaderProgram = initShaderProgram(
  gl,
  vertexShaderSource,
  fragmentShaderSource
);

const programInfo = {
  program: shaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
  },
  uniformLocations: {
    iResolution: gl.getUniformLocation(shaderProgram, "iResolution"),
    iTime: gl.getUniformLocation(shaderProgram, "iTime"),
    uColor1: gl.getUniformLocation(shaderProgram, "uColor1"),
    uColor2: gl.getUniformLocation(shaderProgram, "uColor2"),
    uColor3: gl.getUniformLocation(shaderProgram, "uColor3"),
    uSpinAmount: gl.getUniformLocation(shaderProgram, "uSpinAmount"),
    uContrast: gl.getUniformLocation(shaderProgram, "uContrast"),
    uTurbulence: gl.getUniformLocation(shaderProgram, "uTurbulence"),
    uSwirliness: gl.getUniformLocation(shaderProgram, "uSwirliness"),
  },
};

const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

function resizeCanvasToDisplaySize(canvas) {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  const needResize =
    canvas.width !== displayWidth || canvas.height !== displayHeight;

  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

function hexToRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, 1];
}

let lastUpdateTime = 0;
const updateInterval = 100; // Update every 100ms

function render(now) {
  now *= 0.001; // convert to seconds

  if (now - lastUpdateTime > updateInterval / 1000) {
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.uniform2f(
      programInfo.uniformLocations.iResolution,
      gl.canvas.width,
      gl.canvas.height
    );
    gl.uniform1f(programInfo.uniformLocations.iTime, now);

    gl.uniform4fv(
      programInfo.uniformLocations.uColor1,
      hexToRGB(document.getElementById("color1").value)
    );
    gl.uniform4fv(
      programInfo.uniformLocations.uColor2,
      hexToRGB(document.getElementById("color2").value)
    );
    gl.uniform4fv(
      programInfo.uniformLocations.uColor3,
      hexToRGB(document.getElementById("color3").value)
    );
    gl.uniform1f(
      programInfo.uniformLocations.uSpinAmount,
      parseFloat(document.getElementById("spinAmount").value)
    );
    gl.uniform1f(
      programInfo.uniformLocations.uContrast,
      parseFloat(document.getElementById("contrast").value)
    );
    gl.uniform1f(
      programInfo.uniformLocations.uTurbulence,
      parseFloat(document.getElementById("turbulence").value)
    );
    gl.uniform1f(
      programInfo.uniformLocations.uSwirliness,
      parseFloat(document.getElementById("swirliness").value)
    );

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    lastUpdateTime = now;
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Add event listeners to update shader when controls change
document.querySelectorAll("#controls input").forEach((input) => {
  input.addEventListener(
    "input",
    debounce(() => {
      lastUpdateTime = 0; // Force an update on next frame
      if (input.type === "range") {
        document.getElementById(input.id + "Value").textContent = parseFloat(
          input.value
        ).toFixed(1);
      }
    }, 100)
  );
});

// Toggle panel visibility
const togglePanel = document.getElementById("togglePanel");
const controls = document.getElementById("controls");

togglePanel.addEventListener("click", () => {
  controls.classList.toggle("collapsed");
});

// Toggle fullscreen
const fullscreenToggle = document.getElementById("fullscreenToggle");

fullscreenToggle.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
});

// Update canvas size on fullscreen change
document.addEventListener("fullscreenchange", () => {
  resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
});

// Initialize slider value displays
document.querySelectorAll('#controls input[type="range"]').forEach((input) => {
  document.getElementById(input.id + "Value").textContent = parseFloat(
    input.value
  ).toFixed(1);
});

// Color cycle functionality
const colorCycleButton = document.getElementById("colorCycle");
let isColorCycling = false;
let colorCycleInterval;

function cycleColors() {
  const color1 = document.getElementById("color1");
  const color2 = document.getElementById("color2");
  const color3 = document.getElementById("color3");

  const temp = color1.value;
  color1.value = color2.value;
  color2.value = color3.value;
  color3.value = temp;

  lastUpdateTime = 0; // Force an update on next frame
}

colorCycleButton.addEventListener("click", () => {
  if (isColorCycling) {
    clearInterval(colorCycleInterval);
    colorCycleButton.textContent = "Start Color Cycle";
    isColorCycling = false;
  } else {
    colorCycleInterval = setInterval(cycleColors, 2000); // Cycle every 2 seconds
    colorCycleButton.textContent = "Stop Color Cycle";
    isColorCycling = true;
  }
});
