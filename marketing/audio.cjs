// Original synthesized ambient score; no samples or third-party recordings.
const fs = require("node:fs");
const path = require("node:path");
const rate = 44100,
  duration = 47,
  n = rate * duration,
  b = Buffer.alloc(44 + n * 4);
b.write("RIFF");
b.writeUInt32LE(b.length - 8, 4);
b.write("WAVEfmt ", 8);
b.writeUInt32LE(16, 16);
b.writeUInt16LE(1, 20);
b.writeUInt16LE(2, 22);
b.writeUInt32LE(rate, 24);
b.writeUInt32LE(rate * 4, 28);
b.writeUInt16LE(4, 32);
b.writeUInt16LE(16, 34);
b.write("data", 36);
b.writeUInt32LE(n * 4, 40);
const chords = [
  [146.83, 220, 293.66, 349.23],
  [130.81, 196, 261.63, 329.63],
  [164.81, 220, 329.63, 392],
  [146.83, 220, 293.66, 440],
];
for (let i = 0; i < n; i++) {
  const t = i / rate,
    fade = Math.min(1, t / 2, (duration - t) / 3),
    ch = chords[Math.floor(t / 4) % 4],
    phase = t % 4,
    env = Math.sin((Math.PI * phase) / 4) ** 0.35;
  let v = 0;
  for (let j = 0; j < ch.length; j++)
    v += Math.sin(t * 2 * Math.PI * ch[j]) * 0.035 * env;
  const beat = t % 0.625;
  v +=
    Math.sin(2 * Math.PI * ch[Math.floor(t / 0.625) % 4] * 2 * beat) *
    Math.exp(-beat * 13) *
    0.05;
  v *= fade;
  for (let c = 0; c < 2; c++)
    b.writeInt16LE(Math.round(v * 28000), 44 + i * 4 + c * 2);
}
fs.writeFileSync(path.join(__dirname, "public/soundtrack.wav"), b);
