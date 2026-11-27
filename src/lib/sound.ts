let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new Ctor();
  }
  return sharedContext;
}

/** 完成任务时播放轻柔的双音提示音（纯 Web Audio 合成，无外部素材） */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        /* 浏览器自动播放策略限制时静默忽略 */
      });
    }

    const now = ctx.currentTime;
    const notes: [number, number, number][] = [
      [880, 0, 0.11], // A5
      [1318.51, 0.055, 0.18], // E6
    ];

    for (const [freq, delay, duration] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(0.11, now + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.02);
    }
  } catch {
    /* 测试或无音频设备环境静默跳过 */
  }
}
