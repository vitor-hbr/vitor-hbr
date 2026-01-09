"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  particlesVertexShader,
  particlesFragmentShader,
} from "@/shaders/particles";

const PARTICLE_COUNT = 100;
const PARALLAX_STRENGTH = 0.5;

export function BackgroundCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const animationRef = useRef<number | undefined>(undefined);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;

    // Check for WebGL support
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    // Check if mobile (simplified check)
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const lifetimes = new Float32Array(PARTICLE_COUNT);
    const maxLifetimes = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 2);

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const i2 = i * 2;

      positions[i3] = (Math.random() - 0.5) * 10;
      positions[i3 + 1] = (Math.random() - 0.5) * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 2;

      maxLifetimes[i] = Math.random() * 200 + 100;
      lifetimes[i] = Math.random() * maxLifetimes[i];

      velocities[i2] = (Math.random() - 0.5) * 0.002;
      velocities[i2 + 1] = (Math.random() - 0.5) * 0.002;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aLifetime", new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute(
      "aMaxLifetime",
      new THREE.BufferAttribute(maxLifetimes, 1)
    );

    // Shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: particlesVertexShader,
      fragmentShader: particlesFragmentShader,
      uniforms: {
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uParallax: { value: PARALLAX_STRENGTH },
      },
      transparent: true,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    const animate = () => {
      if (reducedMotionRef.current) {
        renderer.render(scene, camera);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);

      // Update mouse uniform
      material.uniforms.uMouse.value.set(
        mouseRef.current.x,
        mouseRef.current.y
      );

      // Update particles
      const positionAttr = geometry.attributes.position;
      const lifetimeAttr = geometry.attributes.aLifetime;
      const maxLifetimeAttr = geometry.attributes.aMaxLifetime;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const i2 = i * 2;

        // Update position
        (positionAttr.array as Float32Array)[i3] += velocities[i2];
        (positionAttr.array as Float32Array)[i3 + 1] += velocities[i2 + 1];

        // Update lifetime
        (lifetimeAttr.array as Float32Array)[i] -= 1;

        // Respawn dead particles
        if ((lifetimeAttr.array as Float32Array)[i] <= 0) {
          (positionAttr.array as Float32Array)[i3] = (Math.random() - 0.5) * 10;
          (positionAttr.array as Float32Array)[i3 + 1] =
            (Math.random() - 0.5) * 10;
          (positionAttr.array as Float32Array)[i3 + 2] =
            (Math.random() - 0.5) * 2;
          (maxLifetimeAttr.array as Float32Array)[i] =
            Math.random() * 200 + 100;
          (lifetimeAttr.array as Float32Array)[i] =
            (maxLifetimeAttr.array as Float32Array)[i];
          velocities[i2] = (Math.random() - 0.5) * 0.002;
          velocities[i2 + 1] = (Math.random() - 0.5) * 0.002;
        }
      }

      positionAttr.needsUpdate = true;
      lifetimeAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
