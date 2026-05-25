
const gradeToPoints = {
  S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, N: 0,
};

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

function parseTranscript(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l);

    // Assume header logic skipped for unit test focus on rows
    const courses = [];
    let headerIndex = 0; // Simulate header already passed
    
    // We need to simulate the loop logic from script.js
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line || line.toLowerCase().startsWith("gpa")) continue;
      if (line.includes("Sl.No") || /^[LJP]\s+[LJP]/.test(line)) continue;

      let parts = smartSplit(line);
      
      let code = "";
      let codeIndex = -1;
      
      for(let j=0; j<parts.length; j++) {
          if (/^[A-Z]{3,4}\d{3}[A-Z0-9]?$/i.test(parts[j])) {
              code = parts[j];
              codeIndex = j;
              break;
          }
      }
      
      if (!code) continue; 

      let title = "";
      let type = "Theory Only"; 
      let typeIndex = -1;
      
      const knownTypes = ["Theory Only", "Lab Only", "Embedded Theory and Lab", "Soft Skill", "Online Course"];
      
      for(let j=codeIndex+1; j<parts.length; j++) {
          const val = parts[j];
          if (knownTypes.some(t => val.toLowerCase().includes(t.toLowerCase()))) {
              type = val;
              typeIndex = j;
              break;
          }
      }

      if (typeIndex > codeIndex + 1) {
          title = parts.slice(codeIndex + 1, typeIndex).join(" ");
      } else {
           if (parts[codeIndex+1]) title = parts[codeIndex+1];
      }
      
      // NEW LOGIC: Pattern Matching
      let credits = 0;
      for(let j=codeIndex+1; j <= parts.length - 4; j++) {
          const v1 = Number(parts[j]);
          const v2 = Number(parts[j+1]);
          const v3 = Number(parts[j+2]);
          const v4 = Number(parts[j+3]);
          
          if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3) && !isNaN(v4)) {
               credits = v4;
               console.log(`[DEBUG] Row ${code}: Found Credits ${credits} at index ${j+3} (Sequence: ${v1}, ${v2}, ${v3}, ${v4})`);
               break;
          }
      }
      
      // NEW LOGIC: Type Cleaning
      if (type.length > 20 || type.includes(title)) {
           for (const kt of knownTypes) {
               if (type.toLowerCase().includes(kt.toLowerCase())) {
                   type = kt; 
                   if (typeIndex === codeIndex + 1) { 
                       const rawPart = parts[typeIndex];
                       const regex = new RegExp(kt, "i");
                       title = rawPart.replace(regex, "").trim();
                   }
                   break;
               }
           }
      }

      // Total Marks logic
      let total = 0;
      for(let j=parts.length-2; j>codeIndex; j--) {
          const val = Number(parts[j]);
          if (!isNaN(val) && val >= 10 && val <= 100) {
              total = val;
              break;
          }
      }

      // Grade logic
      let grade = "";
      for(let j=parts.length-1; j>Math.max(codeIndex, typeIndex); j--) {
          if (/^[SABCDEFNP]$/i.test(parts[j])) {
              grade = parts[j].toUpperCase();
              break;
          }
      }
      
      const isOnline = ["P", "N", "F", "NULL", "-"].includes(grade.toUpperCase());
      courses.push({ code, title, type, credits, total, grade, isOnline });
    }
    
    return courses;
}

const input = `
4	BCSE202P	Data Structures and Algorithms Lab	Lab Only	0.0	1.0	0.0	1.0	AG	98	S
6	BECE102P	Digital Systems Design Lab	Lab Only	0.0	1.0	0.0	1.0	AG	97	S
9	BMAT205L	Discrete Mathematics and Graph Theory	Theory Only	4.0	0.0	0.0	4.0	RG	84	A
`;

// Simulate worst-case spacing (single spaces)
const inputSpaces = input.replace(/\t/g, " ");

console.log(JSON.stringify(parseTranscript(inputSpaces), null, 2));
