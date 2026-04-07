import { useState, useEffect, useRef } from "react";
import { textToMorseTimeline } from "@/lib/morse";

/**
 * Returns a boolean that flips on/off in a Morse code pattern
 * spelling out the given message. Loops forever.
 */
export function useMorseToggle(message: string, tickMs: number = 150): boolean {
  const timelineRef = useRef<boolean[]>(textToMorseTimeline(message));
  const [on, setOn] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    timelineRef.current = textToMorseTimeline(message);
    indexRef.current = 0;
  }, [message]);

  useEffect(() => {
    const interval = setInterval(() => {
      const timeline = timelineRef.current;
      if (timeline.length === 0) return;

      setOn(timeline[indexRef.current]);
      indexRef.current = (indexRef.current + 1) % timeline.length;
    }, tickMs);

    return () => clearInterval(interval);
  }, [tickMs]);

  return on;
}
