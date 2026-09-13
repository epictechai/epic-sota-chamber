/* Encode real video + club-track WAV in the tab. */
(function (global) {
  function audioBufferToWav(buf) {
    const ch = buf.numberOfChannels;
    const sr = buf.sampleRate;
    const len = buf.length;
    const bytes = len * ch * 2;
    const out = new ArrayBuffer(44 + bytes);
    const v = new DataView(out);
    const wstr = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    wstr(0, "RIFF");
    v.setUint32(4, 36 + bytes, true);
    wstr(8, "WAVE");
    wstr(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, ch, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * 2, true);
    v.setUint16(32, ch * 2, true);
    v.setUint16(34, 16, true);
    wstr(36, "data");
    v.setUint32(40, bytes, true);
    let off = 44;
    const chans = [];
    for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return new Blob([out], { type: "audio/wav" });
  }

  function envGain(ctx, t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  }

  async function renderClubTrack(recipe) {
    const bpm = Number(recipe && recipe.bpm) || 96;
    const beat = 60 / bpm;
    const bars = Math.max(4, Number(recipe && recipe.bars) || Math.ceil(((recipe && recipe.durationSec) || 16) / (4 * beat)));
    const steps = bars * 4;
    const sr = 44100;
    const duration = steps * beat + 0.35;
    const ctx = new OfflineAudioContext(2, Math.ceil(duration * sr), sr);
    const master = ctx.createGain();
    master.gain.value = 0.72;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.14;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    const root = Number(recipe && recipe.rootHz) || 55;
    const scale = Array.isArray(recipe && recipe.scale) && recipe.scale.length ? recipe.scale : [0, 3, 5, 7, 10, 12];

    function kick(t) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(168, t);
      o.frequency.exponentialRampToValueAtTime(36, t + 0.14);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.38);
    }
    function snare(t) {
      const buf = ctx.createBuffer(1, Math.floor(sr * 0.22), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1750;
      const g = envGain(ctx, t, 0.002, 0.18, 0.42);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      const tone = ctx.createOscillator();
      tone.type = "triangle";
      tone.frequency.value = 186;
      const tg = envGain(ctx, t, 0.001, 0.09, 0.18);
      tone.connect(tg);
      tg.connect(master);
      src.start(t);
      tone.start(t);
      tone.stop(t + 0.12);
    }
    function hat(t, open) {
      const buf = ctx.createBuffer(1, Math.floor(sr * (open ? 0.2 : 0.05)), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, open ? 1.1 : 3.2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 8200;
      const g = envGain(ctx, t, 0.001, open ? 0.15 : 0.035, open ? 0.16 : 0.09);
      src.connect(hp);
      hp.connect(g);
      g.connect(master);
      src.start(t);
    }
    function bass(t, deg, len) {
      const hz = root * Math.pow(2, deg / 12);
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(hz, t);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(480, t);
      lp.frequency.exponentialRampToValueAtTime(160, t + len);
      const g = envGain(ctx, t, 0.012, len, 0.3);
      o.connect(lp);
      lp.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + len + 0.02);
    }
    function scratch(t) {
      const buf = ctx.createBuffer(1, Math.floor(sr * 0.14), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const p = i / d.length;
        d[i] = (Math.random() * 2 - 1) * Math.sin(p * Math.PI);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(1.7, t);
      src.playbackRate.exponentialRampToValueAtTime(0.45, t + 0.12);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2500;
      const g = envGain(ctx, t, 0.002, 0.11, 0.24);
      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(t);
    }
    function stab(t) {
      [0, 3, 7].forEach((deg) => {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = root * 2 * Math.pow(2, deg / 12);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 880;
        const g = envGain(ctx, t, 0.004, 0.24, 0.07);
        o.connect(lp);
        lp.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 0.28);
      });
    }

    for (let step = 0; step < steps; step++) {
      const t = step * beat;
      const bar = Math.floor(step / 4);
      const beatIn = step % 4;
      kick(t);
      if (beatIn === 1 || beatIn === 3) snare(t);
      hat(t, false);
      hat(t + beat * 0.5, beatIn === 3);
      if (beatIn === 0) bass(t, scale[bar % scale.length], beat * 0.92);
      else if (beatIn === 2) bass(t, scale[(bar + 2) % scale.length] - 12, beat * 0.72);
      if (bar % 2 === 1 && beatIn === 3) scratch(t + beat * 0.48);
      if (bar === 3 || bar === 7) stab(t);
    }

    const rendered = await ctx.startRendering();
    const blob = audioBufferToWav(rendered);
    const url = URL.createObjectURL(blob);
    if (!(recipe && recipe.silent)) {
      try {
        const live = new (window.AudioContext || window.webkitAudioContext)();
        const src = live.createBufferSource();
        const copy = live.createBuffer(rendered.numberOfChannels, rendered.length, rendered.sampleRate);
        for (let c = 0; c < rendered.numberOfChannels; c++) copy.copyToChannel(rendered.getChannelData(c), c);
        src.buffer = copy;
        src.connect(live.destination);
        src.start();
      } catch {
        /* autoplay block */
      }
    }
    return { blob, url, mime: "audio/wav", duration, bpm, bars, buffer: rendered };
  }

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("frame"));
      im.src = src;
    });
  }

  async function framesToVideo(urls, holdMs, recipe) {
    holdMs = holdMs || 2000;
    const imgs = [];
    for (const u of urls || []) {
      try {
        imgs.push(await loadImg(u));
      } catch {
        /* skip */
      }
    }
    if (!imgs.length) throw new Error("no frames");
    holdMs = Math.max(400, Math.min(holdMs, Math.floor(12000 / imgs.length)));
    const seconds = (imgs.length * holdMs) / 1000;
    const track = await renderClubTrack({ bpm: 96, rootHz: 55, durationSec: seconds, silent: true, ...(recipe || {}) });
    const w = 960;
    const h = 540;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    const vstream = canvas.captureStream(30);
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = actx.createMediaStreamDestination();
    const src = actx.createBufferSource();
    const copy = actx.createBuffer(track.buffer.numberOfChannels, track.buffer.length, track.buffer.sampleRate);
    for (let c = 0; c < track.buffer.numberOfChannels; c++) copy.copyToChannel(track.buffer.getChannelData(c), c);
    src.buffer = copy;
    src.connect(dest);
    src.connect(actx.destination);
    const mixed = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
    const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });
    rec.start(80);
    src.start();
    const extras = (recipe && recipe.extraAudio) || [];
    for (const u of extras) {
      try {
        const ab = await (await fetch(u)).arrayBuffer();
        const decoded = await actx.decodeAudioData(ab.slice(0));
        const ex = actx.createBufferSource();
        ex.buffer = decoded;
        const gx = actx.createGain();
        gx.gain.value = 0.85;
        ex.connect(gx);
        gx.connect(dest);
        gx.connect(actx.destination);
        ex.start();
      } catch {
        /* skip stem */
      }
    }
    for (let i = 0; i < imgs.length; i++) {
      const t0 = performance.now();
      while (performance.now() - t0 < holdMs) {
        const k = (performance.now() - t0) / holdMs;
        const scale = 1 + 0.12 * k;
        g.fillStyle = "#0a0a0a";
        g.fillRect(0, 0, w, h);
        const dw = w * scale;
        const dh = h * scale;
        g.drawImage(imgs[i], (w - dw) / 2 - k * 16, (h - dh) / 2, dw, dh);
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
    rec.stop();
    try {
      src.stop();
    } catch {
      /* already ended */
    }
    const blob = await stopped;
    try {
      actx.close();
    } catch {
      /* ignore */
    }
    return {
      blob,
      url: URL.createObjectURL(blob),
      mime,
      seconds,
      audioUrl: track.url,
      audioMime: "audio/wav",
    };
  }

  async function stitch(parts) {
    const frames = (parts.frames || []).filter(Boolean).slice(0, 10);
    const extraAudio = (parts.audios || []).filter(Boolean).slice(0, 6);
    if (!frames.length) {
      const track = await renderClubTrack({ bpm: 96, rootHz: 55, durationSec: 16 });
      return { kind: "audio", audioUrl: track.url, mime: "audio/wav", seconds: track.duration, stitched: true };
    }
    const hold = frames.length > 6 ? 1400 : 1800;
    const vid = await framesToVideo(frames, hold, { bpm: 96, rootHz: 55, extraAudio });
    return {
      kind: "video",
      videoUrl: vid.url,
      audioUrl: vid.audioUrl,
      mime: vid.mime,
      seconds: vid.seconds,
      frames,
      stitched: true,
    };
  }

  global.ChamberMedia = { renderClubTrack, framesToVideo, audioBufferToWav, stitch };
})(window);
