
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

function findColumnIndex(headerCols, patterns) {
    for (let i = 0; i < headerCols.length; i += 1) {
      const col = headerCols[i].toLowerCase();
      for (const pattern of patterns) {
        if (col.includes(pattern.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
}

function parseTranscript(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l);

    // Find header row
    const headerIndex = lines.findIndex((l) =>
      l.toLowerCase().includes("course code")
    );
    if (headerIndex === -1) {
      console.log("Could not find header row with 'Course Code'.");
      return null;
    }

    // Smart split header
    const headerCols = smartSplit(lines[headerIndex]);
    console.log("Header Cols:", headerCols);

    // Find column indices with multiple pattern options
    const idxCode = findColumnIndex(headerCols, ["course code", "code"]);
    const idxTitle = findColumnIndex(headerCols, ["course title", "title"]);
    const idxType = findColumnIndex(headerCols, ["course type", "type"]);
    
    // Improved Credit Column Detection
    let idxCreditsC = headerCols.findIndex(c => c.trim().toUpperCase() === "C");
    if (idxCreditsC === -1) {
       // Look for "Credits" but only if we can be sure it's the right one?
       // The user input header has "Credits"
       const textCredits = headerCols.findIndex(c => c.trim().toLowerCase() === "credits");
       if (textCredits !== -1) {
           console.log("Found 'Credits' column at index", textCredits, "but need to verify if it matches data C column");
           // In valid VTOP, "Credits" header maps to "C" subcolumn or main credit column
           // We will try to use it if idxCreditsC is -1
           // But wait, the data has L P J C. "Credits" usually sits above these?
           // The "C" column in data is distinct from the "Credits" header position?
           // In the provided input, "Credits" is at header index 4.
           // In data, "Lab Only" is at index 3. L=4, P=5, J=6, C=7.
           // So header "Credits" (4) does NOT align with data "C" (7).
       }
    }

    const idxTotal = findColumnIndex(headerCols, ["grand total", "total", "marks"]);
    const idxGrade = findColumnIndex(headerCols, ["grade"]);
    
    console.log("Indices:", { idxCode, idxTitle, idxType, idxCreditsC, idxTotal, idxGrade });

    const courses = [];
    
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line || line.toLowerCase().startsWith("gpa")) break;

      // Skip sub-header row (L P J C) or header repeats
      const lineLower = line.toLowerCase();
      if (
        lineLower.includes("sl.no") ||
        lineLower.includes("course code") ||
        /^[LJP]\s+[LJP]\s+[LJP]\s+C$/i.test(line.trim())
      ) {
        continue;
      }

      // 1. Clean and split the line
      let parts = smartSplit(line);
      console.log(`Line ${i} parts:`, parts);
      
      // 2. Identify Course Code
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

      // 3. Identify Course Title & Type
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
      
      console.log(`Line ${i} Type Detected: '${type}' at index ${typeIndex}`);

      if (typeIndex > codeIndex + 1) {
          title = parts.slice(codeIndex + 1, typeIndex).join(" ");
      } else if (idxTitle !== -1 && idxTitle > codeIndex) {
          title = parts[idxTitle];
      } else {
           if (parts[codeIndex+1]) title = parts[codeIndex+1];
      }
      
      // 4. Identify Credits (C)
      let credits = 0;
      
      if (idxCreditsC !== -1 && idxCreditsC < parts.length) {
           const val = Number(parts[idxCreditsC]);
           if (!isNaN(val)) credits = val;
      }
      
      if (credits === 0 && typeIndex !== -1 && typeIndex + 4 < parts.length) {
           const val = Number(parts[typeIndex + 4]);
           console.log(`Checking relative credits at ${typeIndex}+4 (${typeIndex+4}):`, parts[typeIndex+4]);
           if (!isNaN(val)) credits = val;
      }

      // 5. Total Marks extraction
      let total = 0;
      if (idxTotal !== -1 && idxTotal < parts.length) {
           const val = Number(parts[idxTotal]);
           if (!isNaN(val)) total = val;
      }
      
      // Fallback Total
      if (total === 0) {
          for(let j=parts.length-2; j>codeIndex; j--) {
              const val = Number(parts[j]);
              if (!isNaN(val) && val >= 10 && val <= 100) {
                  total = val;
                  break;
              }
          }
      }

      // 6. Grade Extraction
      let grade = "";
      if (idxGrade !== -1 && idxGrade < parts.length) {
          grade = parts[idxGrade];
      }
      
      if (!grade || !/^[SABCDEFNP]$/i.test(grade)) {
          for(let j=parts.length-1; j>Math.max(codeIndex, typeIndex); j--) {
              if (/^[SABCDEFNP]$/i.test(parts[j])) {
                  grade = parts[j].toUpperCase();
                  break;
              }
          }
      }
      
      if (code && grade) {
          const isOnline = ["P", "N", "F", "NULL", "-"].includes(grade.toUpperCase());
          courses.push({ code, title, type, credits, total, grade, isOnline });
      }
    }
    
    return courses;
}

const input = `Sl.No.	Course Code	Course Title	Course Type	Credits	Grading Type	Grand Total	Grade	View Mark
L	P	J	C
1	BCHY102N	Environmental Sciences	Online Course	0.0	0.0	0.0	2.0	AG	70	P	
2	BCSE103E	Computer Programming: Java	Embedded Theory and Lab	1.0	2.0	0.0	3.0	AG	98	S	
3	BCSE202L	Data Structures and Algorithms	Theory Only	3.0	0.0	0.0	3.0	RG	80	A	
4	BCSE202P	Data Structures and Algorithms Lab	Lab Only	0.0	1.0	0.0	1.0	AG	98	S	
5	BECE102L	Digital Systems Design	Theory Only	3.0	0.0	0.0	3.0	RG	92	A	
6	BECE102P	Digital Systems Design Lab	Lab Only	0.0	1.0	0.0	1.0	AG	97	S	
7	BENG102P	Technical Report Writing	Lab Only	0.0	1.0	0.0	1.0	AG	86	A	
8	BMAT201L	Complex Variables and Linear Algebra	Theory Only	4.0	0.0	0.0	4.0	RG	92	A	
9	BMAT205L	Discrete Mathematics and Graph Theory	Theory Only	4.0	0.0	0.0	4.0	RG	84	A	
10	BSTS202P	Qualitative Skills Practice II	Soft Skill	0.0	1.5	0.0	1.5	AG	80	A	
11	CFOC575M	Wildlife Ecology	Online Course	0.0	0.0	0.0	3.0	AG	100	S`;

console.log(JSON.stringify(parseTranscript(input.replace(/[ ]{4,}/g, '\t')), null, 2));
