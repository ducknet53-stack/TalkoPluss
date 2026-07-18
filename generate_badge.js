const rOuter = 480;
const rInner = 380;
const cx = 500;
const cy = 500;
const points = 12;
let path = "";

for(let i=0; i<points*2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if(i===0) path += `M ${x} ${y} `;
    else path += `L ${x} ${y} `;
}
path += "Z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <path d="${path}" fill="#1877F2" />
  <path d="M420 680 L250 510 L320 440 L420 540 L730 230 L800 300 Z" fill="#FFFFFF" />
</svg>`;

console.log(svg);
