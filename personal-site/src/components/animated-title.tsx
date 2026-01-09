"use client";

import { useEffect, useState, useRef } from "react";

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
const ANIMATION_DURATION = 400;

interface AnimatedTitleProps {
  text: string;
  className?: string;
}

export function AnimatedTitle({ text, className = "" }: AnimatedTitleProps) {
  const [displayText, setDisplayText] = useState(text);
  const animationRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;
  }, []);

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (reducedMotionRef.current) {
      setDisplayText(text);
      return;
    }

    const targetText = text;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const revealCount = Math.floor(eased * targetText.length);

      let result = "";
      for (let i = 0; i < targetText.length; i++) {
        if (i < revealCount) {
          result += targetText[i];
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }

      setDisplayText(result);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayText(targetText);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [text]);

  return <span className={className}>{displayText}</span>;
}
