import { readRestPreferences } from "./rest-preferences";
export function haptic(kind: "set" | "badge" | "tab" = "set") {
  try {
    if (
      localStorage.getItem("pf-haptics") === "off" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    navigator.vibrate?.(kind === "badge" ? [35, 50, 60] : kind === "tab" ? 8 : 20);
  } catch {
    /* Optional device capability. */
  }
}

let audio: AudioContext | undefined;
export async function primeAudio() {
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {
    /* Audio may be blocked or unavailable. */
  }
}

export function waterSound() {
  try {
    if (localStorage.getItem("pf-water-sound") !== "on") return;
    primeAudio();
    if (!audio) return;
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audio.currentTime + 0.18);
    gain.gain.setValueAtTime(0.06, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.26);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Logging must work without sound. */
  }
}

export function restSound() {
  const preferences = readRestPreferences();
  if (preferences.vibration) haptic("badge");
  if (preferences.muted || preferences.volume === 0) return;
  if (!audio || audio.state !== "running") return;
  try {
    for (const delay of [0, 0.28, 0.56]) {
      const tone = audio.createOscillator(),
        gain = audio.createGain();
      tone.frequency.value = 880;
      tone.type = "triangle";
      gain.gain.setValueAtTime(0.35 * preferences.volume, audio.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + 0.24);
      tone.connect(gain);
      gain.connect(audio.destination);
      tone.start(audio.currentTime + delay);
      tone.stop(audio.currentTime + delay + 0.26);
      tone.onended = () => {
        tone.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    /* Optional feedback must not affect the workout. */
  }
}
