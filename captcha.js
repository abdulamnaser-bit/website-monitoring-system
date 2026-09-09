// captcha.js — generates a small distorted SVG captcha string.
// No native canvas dependency, so it installs cleanly anywhere.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function randomText(len = 5) {
  let out = '';
  for (let i = 0; i < len; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}

function rand(min, max) { return Math.random() * (max - min) + min; }

function renderSVG(text) {
  const width = 170;
  const height = 60;
  const colors = ['#39ffe0', '#7cf7ff', '#a8ffea', '#5df2c4'];

  let noiseLines = '';
  for (let i = 0; i < 6; i++) {
    noiseLines += `<line x1="${rand(0, width)}" y1="${rand(0, height)}" x2="${rand(0, width)}" y2="${rand(0, height)}" stroke="#1c3f45" stroke-width="1" opacity="0.6"/>`;
  }
  let dots = '';
  for (let i = 0; i < 40; i++) {
    dots += `<circle cx="${rand(0, width)}" cy="${rand(0, height)}" r="0.8" fill="#0d3a3a" opacity="0.7"/>`;
  }

  const spacing = width / (text.length + 1);
  let glyphs = '';
  [...text].forEach((ch, i) => {
    const x = spacing * (i + 1) + rand(-6, 6);
    const y = height / 2 + rand(-6, 6);
    const rot = rand(-28, 28);
    const size = rand(26, 34);
    const color = colors[i % colors.length];
    glyphs += `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-size="${size}" font-family="'Courier New', monospace" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="middle">${ch}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#04181a"/>
    ${dots}
    ${noiseLines}
    ${glyphs}
  </svg>`;
}

function generate() {
  const text = randomText(5);
  return { text, svg: renderSVG(text) };
}

module.exports = { generate };
