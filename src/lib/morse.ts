const MORSE: Record<string, string> = {
  a: ".-",    b: "-...",  c: "-.-.",  d: "-..",
  e: ".",     f: "..-.",  g: "--.",   h: "....",
  i: "..",    j: ".---",  k: "-.-",  l: ".-..",
  m: "--",    n: "-.",    o: "---",   p: ".--.",
  q: "--.-",  r: ".-.",   s: "...",   t: "-",
  u: "..-",   v: "...-",  w: ".--",  x: "-..-",
  y: "-.--",  z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...",
  "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "'": ".----.",
};

/**
 * Convert a text string into a boolean timeline for Morse code.
 * true = signal on, false = signal off.
 *
 * Timing (in "units"):
 *   dot = 1 on
 *   dash = 3 on
 *   between symbols in a letter = 1 off
 *   between letters = 3 off
 *   between words = 7 off
 */
export function textToMorseTimeline(text: string): boolean[] {
  const timeline: boolean[] = [];
  const words = text.toLowerCase().split(/\s+/);

  for (let w = 0; w < words.length; w++) {
    if (w > 0) {
      // Word gap: 7 off
      for (let i = 0; i < 7; i++) timeline.push(false);
    }

    const letters = words[w].split("");
    for (let l = 0; l < letters.length; l++) {
      if (l > 0) {
        // Letter gap: 3 off
        for (let i = 0; i < 3; i++) timeline.push(false);
      }

      const pattern = MORSE[letters[l]];
      if (!pattern) continue;

      for (let s = 0; s < pattern.length; s++) {
        if (s > 0) {
          // Symbol gap: 1 off
          timeline.push(false);
        }
        const len = pattern[s] === "." ? 1 : 3;
        for (let i = 0; i < len; i++) timeline.push(true);
      }
    }
  }

  // Add a long pause at the end before looping
  for (let i = 0; i < 14; i++) timeline.push(false);

  return timeline;
}
