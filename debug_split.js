
function smartSplit(line) {
    if (line.includes("\t")) {
      return line.split(/\t+/).map((p) => p.trim());
    }
    const parts = line.split(/\s{2,}/);
    if (parts.length >= 5) {
      return parts.map((p) => p.trim());
    }
    const allParts = line.split(/\s+/);
    const merged = [];
    let current = "";
    for (let i = 0; i < allParts.length; i += 1) {
      const part = allParts[i];
      if (/^\d+\.?\d*$/.test(part) || /^[A-Z]$/i.test(part)) {
        if (current) {
          merged.push(current.trim());
          current = "";
        }
        merged.push(part);
      } else {
        current += (current ? " " : "") + part;
      }
    }
    if (current) merged.push(current.trim());
    return merged;
}

const line4 = "4	BCSE202P	Data Structures and Algorithms Lab	Lab Only	0.0	1.0	0.0	1.0	AG	98	S";
// Replace tabs with single spaces to simulate the "worst case" paste scenario
const line4_spaces = line4.replace(/\t/g, " "); 

console.log("Original Line:", line4_spaces);
const parts = smartSplit(line4_spaces);
console.log("Parts:", parts);

parts.forEach((p, i) => {
    console.log(`[${i}] ${p}`);
});

const knownTypes = ["Theory Only", "Lab Only", "Embedded Theory and Lab", "Soft Skill", "Online Course"];
let typeIndex = -1;
let type = "";

for(let j=1; j<parts.length; j++) {
  const val = parts[j];
  if (knownTypes.some(t => val.toLowerCase().includes(t.toLowerCase()))) {
      type = val;
      typeIndex = j;
      console.log(`DETECTED TYPE at index ${j}: ${val}`);
      break;
  }
}

if (typeIndex !== -1) {
    console.log(`Target Credit Index: ${typeIndex} + 4 = ${typeIndex+4}`);
    console.log(`Value at Target: '${parts[typeIndex+4]}'`);
    console.log(`Parsed Value: ${Number(parts[typeIndex+4])}`);
}
