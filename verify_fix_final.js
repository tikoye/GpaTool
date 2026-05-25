
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
      // Keep numbers, single letters (Grade), AND Course Codes (e.g. BCSE101L) separate
      if (/^\d+\.?\d*$/.test(part) || /^[A-Z]$/i.test(part) || /^[A-Z]{3,4}\d{3}[A-Z0-9]?$/i.test(part)) {
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

function parseTest(lines) {
    const courses = [];
    
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      
      let parts = smartSplit(line);
      console.log(`PARTS:`, parts);

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
      
      // Clean title logic
      if (typeIndex === -1 || (typeIndex === codeIndex+1 && type.includes(title))) {
           const checkStr = typeIndex === -1 ? title : type;
           for (const kt of knownTypes) {
               if (checkStr.toLowerCase().includes(kt.toLowerCase())) {
                   type = kt;
                   title = checkStr.replace(new RegExp(kt, "i"), "").trim();
                   if (typeIndex === -1) typeIndex = codeIndex + 1;
                   break;
               }
           }
      }
      
      let credits = 0;
      // Pattern Matching Logic (L P J C)
      for(let j=codeIndex+1; j <= parts.length - 4; j++) {
          const v1 = Number(parts[j]);
          const v2 = Number(parts[j+1]);
          const v3 = Number(parts[j+2]);
          const v4 = Number(parts[j+3]);
          
          if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3) && !isNaN(v4)) {
               credits = v4;
               break;
          }
      }

      courses.push({ code, title, type, credits });
    }
    return courses;
}

const input = [
"4 BCSE202P Data Structures and Algorithms Lab Lab Only 0.0 1.0 0.0 1.0 AG 98 S",
"9 BMAT205L Discrete Mathematics and Graph Theory Theory Only 4.0 0.0 0.0 4.0 RG 84 A"
];

console.log(JSON.stringify(parseTest(input), null, 2));
