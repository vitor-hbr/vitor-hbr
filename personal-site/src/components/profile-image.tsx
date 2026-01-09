"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import {
  profileVertexShader,
  profileFragmentShader,
} from "@/shaders/profile";

const IMAGE_SIZE = 200;
const PIXEL_SIZE = 4;
const DISPERSION_STRENGTH = 0.15;
const COLUMN_GRID_SIZE = 48;
const MIN_COLUMN_HEIGHT = 2;
const MAX_COLUMN_HEIGHT = 25;
const HEIGHT_INVERSION_SPEED = 0.008;

// Shaders for instanced columns
const columnVertexShader = `
  attribute vec3 instancePosition;
  attribute vec3 instanceColor;
  attribute float normalHeight;
  attribute float invertedHeight;

  uniform float uTransition;
  uniform float uInversion;

  varying vec3 vColor;
  varying vec3 vNormal;

  void main() {
    vColor = instanceColor;
    vNormal = normalMatrix * normal;

    // Calculate current height based on inversion
    float t = uInversion;
    float currentHeight = mix(normalHeight, invertedHeight, t);

    // Apply transition (columns rise up)
    currentHeight *= uTransition;

    // Scale the box height
    vec3 pos = position;
    pos.y *= max(currentHeight / normalHeight, 0.01);

    // Position the box (y is half height to sit on ground)
    pos.y += currentHeight * 0.5;
    pos.x += instancePosition.x;
    pos.z += instancePosition.z;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const columnFragmentShader = `
  varying vec3 vColor;
  varying vec3 vNormal;

  void main() {
    // Simple lighting
    vec3 light = normalize(vec3(0.5, 1.0, 0.5));
    float diffuse = max(dot(vNormal, light), 0.0);
    float ambient = 0.4;
    float brightness = ambient + diffuse * 0.6;

    gl_FragColor = vec4(vColor * brightness, 1.0);
  }
`;

export function ProfileImage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const expandedContainerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const smallImageRectRef = useRef<DOMRect | null>(null);

  // Main scene refs (small image)
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    animationId: number;
    texture: THREE.Texture;
  } | null>(null);

  // Expanded scene refs (3D columns)
  const expandedSceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    columnMesh: THREE.InstancedMesh;
    material: THREE.ShaderMaterial;
    animationId: number;
    isDragging: boolean;
    dragStartPosition: { x: number; y: number };
    previousMousePosition: { x: number; y: number };
    targetRotation: { x: number; y: number };
    currentRotation: { x: number; y: number };
    transitionProgress: number;
    inversionProgress: number;
    inversionDirection: number;
    isClosing: boolean;
    hasDragged: boolean;
    // Animation state
    startRect: DOMRect;
    cameraStartPos: THREE.Vector3;
    cameraEndPos: THREE.Vector3;
    meshStartScale: number;
    meshEndScale: number;
  } | null>(null);

  const hoverRef = useRef({ target: 0, current: 0 });
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const reducedMotionRef = useRef(false);
  const imageDataRef = useRef<ImageData | null>(null);

  // Load actual image and create texture
  const loadImage = useCallback((): Promise<{ texture: THREE.Texture; imageData: ImageData }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = IMAGE_SIZE;
        canvas.height = IMAGE_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, IMAGE_SIZE, IMAGE_SIZE);

        const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
        imageDataRef.current = imageData;

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        resolve({ texture, imageData });
      };
      img.onerror = () => {
        const { texture, imageData } = createPlaceholderTexture();
        imageDataRef.current = imageData;
        resolve({ texture, imageData });
      };
      img.src = "/profile.jpg";
    });
  }, []);

  function createPlaceholderTexture(): { texture: THREE.DataTexture; imageData: ImageData } {
    const size = IMAGE_SIZE;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const cx = size / 2;
        const cy = size / 2;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = size / 2 - 10;

        if (dist < radius) {
          const t = dist / radius;
          const angle = Math.atan2(dy, dx);
          const hue = ((angle + Math.PI) / (2 * Math.PI)) * 0.2 + 0.95;
          const sat = 0.6;
          const light = 0.5 + (1 - t) * 0.2;

          const c = (1 - Math.abs(2 * light - 1)) * sat;
          const hPrime = hue * 6;
          const xVal = c * (1 - Math.abs((hPrime % 2) - 1));
          const m = light - c / 2;

          let r = 0, g = 0, b = 0;
          if (hPrime < 1) { r = c; g = xVal; }
          else if (hPrime < 2) { r = xVal; g = c; }
          else if (hPrime < 3) { g = c; b = xVal; }
          else if (hPrime < 4) { g = xVal; b = c; }
          else if (hPrime < 5) { r = xVal; b = c; }
          else { r = c; b = xVal; }

          data[i] = Math.floor((r + m) * 255);
          data[i + 1] = Math.floor((g + m) * 255);
          data[i + 2] = Math.floor((b + m) * 255);
          data[i + 3] = 255;
        } else {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }
    }

    const texture = new THREE.DataTexture(data, size, size);
    texture.needsUpdate = true;
    const imageData = new ImageData(new Uint8ClampedArray(data), size, size);

    return { texture, imageData };
  }

  // Initialize main (small) scene
  useEffect(() => {
    if (!containerRef.current) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    const scene = new THREE.Scene();
    const aspect = 1;
    const frustum = IMAGE_SIZE / 2;
    const camera = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      1000
    );
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(IMAGE_SIZE, IMAGE_SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    const gridSize = Math.floor(IMAGE_SIZE / PIXEL_SIZE);
    const positions = new Float32Array(gridSize * gridSize * 3);
    const uvs = new Float32Array(gridSize * gridSize * 2);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const i = y * gridSize + x;
        positions[i * 3] = (x / gridSize - 0.5) * IMAGE_SIZE;
        positions[i * 3 + 1] = (y / gridSize - 0.5) * IMAGE_SIZE;
        positions[i * 3 + 2] = 0;
        uvs[i * 2] = x / gridSize;
        uvs[i * 2 + 1] = y / gridSize;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aUv", new THREE.BufferAttribute(uvs, 2));

    const material = new THREE.ShaderMaterial({
      vertexShader: profileVertexShader,
      fragmentShader: profileFragmentShader,
      uniforms: {
        uTexture: { value: null },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uHover: { value: 0 },
        uStrength: { value: DISPERSION_STRENGTH * IMAGE_SIZE },
      },
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    loadImage().then(({ texture }) => {
      material.uniforms.uTexture.value = texture;
      if (sceneRef.current) {
        sceneRef.current.texture = texture;
      }
    });

    sceneRef.current = {
      scene,
      camera,
      renderer,
      material,
      animationId: 0,
      texture: null as unknown as THREE.Texture
    };

    const animate = () => {
      if (!sceneRef.current) return;
      sceneRef.current.animationId = requestAnimationFrame(animate);

      if (!reducedMotionRef.current) {
        const diff = hoverRef.current.target - hoverRef.current.current;
        hoverRef.current.current += diff * 0.1;
        material.uniforms.uHover.value = hoverRef.current.current;
        material.uniforms.uMouse.value.set(mouseRef.current.x, mouseRef.current.y);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [loadImage]);

  // Initialize expanded (3D columns) scene with instanced rendering
  useEffect(() => {
    if (!isExpanded || !expandedContainerRef.current || !imageDataRef.current || !smallImageRectRef.current) return;

    const container = expandedContainerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const startRect = smallImageRectRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

    // Calculate start and end camera positions
    // Start: camera positioned to make the mesh appear at the profile image location
    const startCenterX = (startRect.left + startRect.width / 2 - width / 2);
    const startCenterY = -(startRect.top + startRect.height / 2 - height / 2);

    // Scale factor: how big should the mesh be at start vs end
    const meshSize = COLUMN_GRID_SIZE; // The mesh spans roughly this many units
    const startScale = startRect.width / (meshSize * 2.5); // Scale to match profile image size
    const endScale = 1;

    // Camera positions
    const startDistance = 20;
    const endDistance = 80;

    const cameraStartPos = new THREE.Vector3(
      startCenterX * 0.05,
      startCenterY * 0.05 + 10 * startScale,
      startDistance
    );
    const cameraEndPos = new THREE.Vector3(0, 40, endDistance);

    camera.position.copy(cameraStartPos);
    camera.lookAt(startCenterX * 0.05, startCenterY * 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const imageData = imageDataRef.current;
    const step = IMAGE_SIZE / COLUMN_GRID_SIZE;
    const halfGrid = (COLUMN_GRID_SIZE - 1) / 2;

    // First pass: collect luminance values and count valid pixels
    const pixelData: { x: number; z: number; r: number; g: number; b: number; lum: number }[] = [];

    for (let y = 0; y < COLUMN_GRID_SIZE; y++) {
      for (let x = 0; x < COLUMN_GRID_SIZE; x++) {
        const px = Math.floor(x * step);
        const py = Math.floor((COLUMN_GRID_SIZE - 1 - y) * step);
        const i = (py * IMAGE_SIZE + px) * 4;
        const a = imageData.data[i + 3];

        if (a >= 50) {
          const r = imageData.data[i] / 255;
          const g = imageData.data[i + 1] / 255;
          const b = imageData.data[i + 2] / 255;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          pixelData.push({
            x: (x - halfGrid) * 1.0,
            z: (y - halfGrid) * 1.0,
            r, g, b, lum
          });
        }
      }
    }

    const instanceCount = pixelData.length;
    const luminances = pixelData.map(p => p.lum);
    const minLum = Math.min(...luminances);
    const maxLum = Math.max(...luminances);
    const lumRange = maxLum - minLum || 1;

    // Create instanced geometry
    const boxGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);

    // Create instance attributes
    const instancePositions = new Float32Array(instanceCount * 3);
    const instanceColors = new Float32Array(instanceCount * 3);
    const normalHeights = new Float32Array(instanceCount);
    const invertedHeights = new Float32Array(instanceCount);

    pixelData.forEach((pixel, idx) => {
      const normalizedLum = (pixel.lum - minLum) / lumRange;
      const normalHeight = MIN_COLUMN_HEIGHT + normalizedLum * (MAX_COLUMN_HEIGHT - MIN_COLUMN_HEIGHT);
      const invertedHeight = MIN_COLUMN_HEIGHT + (1 - normalizedLum) * (MAX_COLUMN_HEIGHT - MIN_COLUMN_HEIGHT);

      instancePositions[idx * 3] = pixel.x;
      instancePositions[idx * 3 + 1] = 0;
      instancePositions[idx * 3 + 2] = pixel.z;

      instanceColors[idx * 3] = pixel.r;
      instanceColors[idx * 3 + 1] = pixel.g;
      instanceColors[idx * 3 + 2] = pixel.b;

      normalHeights[idx] = normalHeight;
      invertedHeights[idx] = invertedHeight;
    });

    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: columnVertexShader,
      fragmentShader: columnFragmentShader,
      uniforms: {
        uTransition: { value: 0 },
        uInversion: { value: 0 },
      },
      side: THREE.FrontSide,
    });

    // Create instanced mesh
    const columnMesh = new THREE.InstancedMesh(boxGeometry, material, instanceCount);

    // Add instance attributes
    boxGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    boxGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
    boxGeometry.setAttribute('normalHeight', new THREE.InstancedBufferAttribute(normalHeights, 1));
    boxGeometry.setAttribute('invertedHeight', new THREE.InstancedBufferAttribute(invertedHeights, 1));

    // Set identity matrices for all instances
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < instanceCount; i++) {
      columnMesh.setMatrixAt(i, matrix);
    }

    // Start with small scale and offset position
    columnMesh.scale.setScalar(startScale);
    columnMesh.position.set(startCenterX * 0.05, startCenterY * 0.05, 0);
    columnMesh.rotation.set(1, Math.PI, 0);

    scene.add(columnMesh);

    expandedSceneRef.current = {
      scene,
      camera,
      renderer,
      columnMesh,
      material,
      animationId: 0,
      isDragging: false,
      dragStartPosition: { x: 0, y: 0 },
      previousMousePosition: { x: 0, y: 0 },
      targetRotation: { x: 1, y: Math.PI },
      currentRotation: { x: 1, y: Math.PI },
      transitionProgress: 0,
      inversionProgress: 0,
      inversionDirection: 1,
      isClosing: false,
      hasDragged: false,
      startRect,
      cameraStartPos,
      cameraEndPos,
      meshStartScale: startScale,
      meshEndScale: endScale,
    };

    const animate = () => {
      if (!expandedSceneRef.current) return;
      expandedSceneRef.current.animationId = requestAnimationFrame(animate);

      const state = expandedSceneRef.current;
      const t = state.transitionProgress;
      const eased = easeOutCubic(t);

      // Update backdrop opacity
      if (backdropRef.current) {
        backdropRef.current.style.opacity = String(eased);
      }

      if (state.isClosing) {
        // Closing animation
        state.transitionProgress = Math.max(0, state.transitionProgress - 0.035);

        if (state.transitionProgress <= 0) {
          setIsExpanded(false);
          return;
        }
      } else {
        // Opening animation
        if (state.transitionProgress < 1) {
          state.transitionProgress = Math.min(1, state.transitionProgress + 0.035);
        } else {
          // Height inversion animation (only when fully open)
          state.inversionProgress += HEIGHT_INVERSION_SPEED * state.inversionDirection;

          if (state.inversionProgress >= 1) {
            state.inversionDirection = -1;
          } else if (state.inversionProgress <= 0) {
            state.inversionDirection = 1;
          }

          material.uniforms.uInversion.value = easeInOutSine(Math.max(0, Math.min(1, state.inversionProgress)));
        }
      }

      // Interpolate camera position
      camera.position.lerpVectors(state.cameraStartPos, state.cameraEndPos, eased);

      // Interpolate mesh scale
      const currentScale = state.meshStartScale + (state.meshEndScale - state.meshStartScale) * eased;
      columnMesh.scale.setScalar(currentScale);

      // Interpolate mesh position (from offset to center)
      const startX = (startRect.left + startRect.width / 2 - width / 2) * 0.05;
      const startY = -(startRect.top + startRect.height / 2 - height / 2) * 0.05;
      columnMesh.position.x = startX * (1 - eased);
      columnMesh.position.y = startY * (1 - eased);

      // Column height transition
      material.uniforms.uTransition.value = eased;

      // Camera look at interpolation
      const lookAtY = 10 * (1 - eased);
      camera.lookAt(columnMesh.position.x, lookAtY, 0);

      // Smooth rotation (only apply user rotation after opening)
      if (state.transitionProgress >= 1 || state.isClosing) {
        state.currentRotation.x += (state.targetRotation.x - state.currentRotation.x) * 0.05;
        state.currentRotation.y += (state.targetRotation.y - state.currentRotation.y) * 0.05;
      }
      columnMesh.rotation.x = state.currentRotation.x;
      columnMesh.rotation.y = state.currentRotation.y;

      renderer.render(scene, camera);
    };

    animate();

    // Mouse/touch handlers
    const handlePointerDown = (e: PointerEvent) => {
      if (!expandedSceneRef.current || expandedSceneRef.current.isClosing) return;
      if (expandedSceneRef.current.transitionProgress < 1) return; // Don't allow interaction during opening

      expandedSceneRef.current.isDragging = true;
      expandedSceneRef.current.hasDragged = false;
      expandedSceneRef.current.dragStartPosition = { x: e.clientX, y: e.clientY };
      expandedSceneRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!expandedSceneRef.current || !expandedSceneRef.current.isDragging) return;

      const deltaX = e.clientX - expandedSceneRef.current.previousMousePosition.x;
      const deltaY = e.clientY - expandedSceneRef.current.previousMousePosition.y;

      // Check if user has actually dragged
      const totalDeltaX = e.clientX - expandedSceneRef.current.dragStartPosition.x;
      const totalDeltaY = e.clientY - expandedSceneRef.current.dragStartPosition.y;
      if (Math.abs(totalDeltaX) > 5 || Math.abs(totalDeltaY) > 5) {
        expandedSceneRef.current.hasDragged = true;
      }

      expandedSceneRef.current.targetRotation.y += deltaX * 0.005;
      expandedSceneRef.current.targetRotation.x += deltaY * 0.005;
      expandedSceneRef.current.targetRotation.x = Math.max(
        -Math.PI / 3,
        Math.min(Math.PI / 2, expandedSceneRef.current.targetRotation.x)
      );

      expandedSceneRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = () => {
      if (!expandedSceneRef.current) return;

      // If user clicked without dragging and animation is complete, close
      if (!expandedSceneRef.current.hasDragged &&
          !expandedSceneRef.current.isClosing &&
          expandedSceneRef.current.transitionProgress >= 1) {
        expandedSceneRef.current.isClosing = true;
      }

      expandedSceneRef.current.isDragging = false;
    };

    const handleResize = () => {
      if (!expandedSceneRef.current) return;
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedSceneRef.current && !expandedSceneRef.current.isClosing) {
        expandedSceneRef.current.isClosing = true;
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (expandedSceneRef.current) {
        cancelAnimationFrame(expandedSceneRef.current.animationId);
      }
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);

      boxGeometry.dispose();
      material.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isExpanded]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotionRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current.x = (e.clientX - rect.left) / rect.width;
    mouseRef.current.y = 1 - (e.clientY - rect.top) / rect.height;
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (reducedMotionRef.current) return;
    hoverRef.current.target = 1;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (reducedMotionRef.current) return;
    hoverRef.current.target = 0;
  }, []);

  const handleClick = useCallback(() => {
    if (reducedMotionRef.current) return;
    if (containerRef.current) {
      smallImageRectRef.current = containerRef.current.getBoundingClientRect();
    }
    setIsExpanded(true);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="relative cursor-pointer"
        style={{
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
          opacity: isExpanded ? 0 : 1,
          transition: "opacity 0.15s ease-out"
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role="button"
        aria-label="Click to expand profile visualization"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
      />

      {isExpanded && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop - opacity controlled by animation */}
          <div
            ref={backdropRef}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            style={{ opacity: 0 }}
          />

          {/* 3D Canvas */}
          <div
            ref={expandedContainerRef}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          />

          {/* Close hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted text-sm pointer-events-none">
            drag to rotate • click or press ESC to close
          </div>
        </div>
      )}
    </>
  );
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}
