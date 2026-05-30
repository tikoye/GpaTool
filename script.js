const STORAGE_KEYS = {
  USERS: "cgpa_companion_users",
  SESSION: "cgpa_companion_session",
  THEME: "cgpa_companion_theme",
  SEMESTERS: "cgpa_companion_semesters",
};

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyDfZWaLPBwWYvT3BPy3VzEpbxARVXH-jpU",
  authDomain: "flexgpa.firebaseapp.com",
  projectId: "flexgpa",
  storageBucket: "flexgpa.firebasestorage.app",
  messagingSenderId: "256581553015",
  appId: "1:256581553015:web:67e79335e52360fb586f72",
  measurementId: "G-6E76T27ZPR"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let isGuest = false;
let unsubscribeSnapshot = null;
let isLocalSyncing = false;

auth.onAuthStateChanged(user => {
  const loader = document.getElementById("initialLoader");
  if (loader) loader.style.display = "none";

  if (user) {
    if (user.email && user.email.endsWith("@vitstudent.ac.in")) {
      currentUser = user;
      isGuest = false;
      document.getElementById("authOverlay").style.display = "none";
      document.getElementById("userProfileBtn").style.display = "flex";
      const headerLoginBtn = document.getElementById("headerLoginBtn");
      if (headerLoginBtn) headerLoginBtn.style.display = "none";
      document.getElementById("userProfileImg").src = user.photoURL || "";
      
      startRealtimeSync();
    } else {
      auth.signOut();
      document.getElementById("authErrorMsg").textContent = "Access denied: Please sign in with your @vitstudent.ac.in email.";
      document.getElementById("authErrorMsg").style.display = "block";
      document.getElementById("authOverlay").style.display = "flex";
    }
  } else {
    currentUser = null;
    if (!isGuest) {
      document.getElementById("authOverlay").style.display = "flex";
    }
    document.getElementById("userProfileBtn").style.display = "none";
    const headerLoginBtn = document.getElementById("headerLoginBtn");
    if (headerLoginBtn) {
      headerLoginBtn.style.display = isGuest ? "flex" : "none";
    }
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      // Enforce the vitstudent.ac.in domain in the Google prompt
      provider.setCustomParameters({
        hd: "vitstudent.ac.in"
      });
      auth.signInWithPopup(provider).catch(err => {
        document.getElementById("authErrorMsg").textContent = err.message;
        document.getElementById("authErrorMsg").style.display = "block";
      });
    });
  }

  const guestSignInBtn = document.getElementById("guestSignInBtn");
  if (guestSignInBtn) {
    guestSignInBtn.addEventListener("click", () => {
      isGuest = true;
      document.getElementById("authOverlay").style.display = "none";
      document.getElementById("userProfileBtn").style.display = "none";
      const headerLoginBtn = document.getElementById("headerLoginBtn");
      if (headerLoginBtn) headerLoginBtn.style.display = "flex";
    });
  }

  const userProfileBtn = document.getElementById("userProfileBtn");
  if (userProfileBtn) {
    userProfileBtn.addEventListener("click", () => {
      if (confirm("Sign out of FlexGPA?")) {
        auth.signOut();
      }
    });
  }

  const headerLoginBtn = document.getElementById("headerLoginBtn");
  if (headerLoginBtn) {
    headerLoginBtn.addEventListener("click", () => {
      document.getElementById("authOverlay").style.display = "flex";
      headerLoginBtn.style.display = "none";
    });
  }
});

function startRealtimeSync() {
  if (!currentUser) return;
  
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  
  unsubscribeSnapshot = db.collection("users").doc(currentUser.uid).onSnapshot((doc) => {
    if (isLocalSyncing) return; // Ignore if we caused the change
    
    if (doc.exists) {
      const data = doc.data();
      let changed = false;
      
      const checkAndSet = (key, newData) => {
        const currentData = localStorage.getItem(key);
        const newStr = JSON.stringify(newData || (key.endsWith('courses') || key.endsWith('semesters') ? [] : {}));
        if (currentData !== newStr) {
          localStorage.setItem(key, newStr);
          changed = true;
        }
      };

      checkAndSet(STORAGE_KEYS.SEMESTERS, data.semesters);
      checkAndSet("gpaflex_semgpa_courses", data.gpaflex_semgpa_courses);
      checkAndSet("gpaflex_instant_cgpa", data.gpaflex_instant_cgpa);
      checkAndSet("gpaflex_cgpa_semesters", data.gpaflex_cgpa_semesters);
      checkAndSet("gpaflex_target_gpa", data.gpaflex_target_gpa);
      
      if (changed) {
        // Quick reload to show changes cleanly without flash
        const loader = document.getElementById("initialLoader");
        if (loader) loader.style.display = "flex";
        setTimeout(() => window.location.reload(), 100);
      }
    }
  }, (e) => {
    console.error("Error in realtime sync:", e);
  });
}

async function syncToCloud() {
  if (!currentUser || isGuest) return;
  try {
    isLocalSyncing = true;
    const data = {
      semesters: JSON.parse(localStorage.getItem(STORAGE_KEYS.SEMESTERS) || "{}"),
      gpaflex_semgpa_courses: JSON.parse(localStorage.getItem("gpaflex_semgpa_courses") || "[]"),
      gpaflex_instant_cgpa: JSON.parse(localStorage.getItem("gpaflex_instant_cgpa") || "{}"),
      gpaflex_cgpa_semesters: JSON.parse(localStorage.getItem("gpaflex_cgpa_semesters") || "[]"),
      gpaflex_target_gpa: JSON.parse(localStorage.getItem("gpaflex_target_gpa") || "{}")
    };
    await db.collection("users").doc(currentUser.uid).set(data, { merge: true });
    // Reset local sync flag after a short delay to allow snapshot to fire and be ignored
    setTimeout(() => { isLocalSyncing = false; }, 1000);
  } catch(e) {
    console.error("Error syncing to cloud:", e);
    isLocalSyncing = false;
  }
}

// Hook into localStorage.setItem to auto-sync to cloud
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  originalSetItem.apply(this, arguments);
  const syncKeys = [
    STORAGE_KEYS.SEMESTERS,
    "gpaflex_semgpa_courses",
    "gpaflex_instant_cgpa",
    "gpaflex_cgpa_semesters",
    "gpaflex_target_gpa"
  ];
  if (syncKeys.includes(key)) {
    syncToCloud();
  }
};
// --- END FIREBASE SETUP ---


const gradeToPoints = {
  S: 10,
  A: 9,
  B: 8,
  C: 7,
  D: 6,
  E: 5,
  F: 0,
  N: 0,
};

let currentAuthMode = "signin";
let deferredPrompt = null;

function $(selector) {
  return document.querySelector(selector);
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function loadSemesters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEMESTERS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSemesters(map) {
  localStorage.setItem(STORAGE_KEYS.SEMESTERS, JSON.stringify(map));
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  const themeDropdown = $("#themeDropdown");
  if (themeDropdown && themeDropdown.value !== theme) {
    themeDropdown.value = theme;
  }
}

function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  const theme = stored || "normal";
  applyTheme(theme);
  
  const themeDropdown = $("#themeDropdown");
  if (themeDropdown) {
    themeDropdown.addEventListener("change", (e) => {
      applyTheme(e.target.value);
    });
  }
}

function getCurrentUsername() {
  const users = loadUsers();
  return Object.keys(users)[0] || "User";
}

function sortSemesterList(list) {
  const termOrder = { Fall: 0, Winter: 1 };
  return list.sort((a, b) => {
    const aYear = parseInt(a.yearLabel.slice(0, 4), 10) || 0;
    const bYear = parseInt(b.yearLabel.slice(0, 4), 10) || 0;
    if (aYear !== bYear) return aYear - bYear;
    return (termOrder[a.term] ?? 0) - (termOrder[b.term] ?? 0);
  });
}

function setupGpaCalculator() {
  const form = $("#courseForm");
  const tableBody = $("#coursesTable tbody");
  const totalCreditsEl = $("#gpaTotalCredits");
  const gpaResultEl = $("#gpaResult");

  if (!form || !tableBody) return;

  const courses = [];
  try {
    const saved = localStorage.getItem("gpaflex_semgpa_courses");
    if (saved) { courses.push(...JSON.parse(saved)); }
  } catch(e) {}

  function render() {
    tableBody.innerHTML = "";
    let totalCredits = 0;
    let totalPoints = 0;

    courses.forEach((course, index) => {
      const effectiveCredits = course.creditsForGpa ?? course.credits;
      const points = effectiveCredits * (gradeToPoints[course.grade] ?? 0);
      totalCredits += effectiveCredits;
      totalPoints += points;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${course.title || '<span class="chip">Untitled</span>'}</td>
        <td>${course.credits}</td>
        <td><span class="chip">${course.grade}</span></td>
        <td><button class="delete-button" data-index="${index}">✕</button></td>
      `;
      tableBody.appendChild(tr);
    });

    const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
    totalCreditsEl.textContent = totalCredits.toFixed(2).replace(/\.00$/, "");
    gpaResultEl.textContent = gpa.toFixed(2);

    tableBody.querySelectorAll(".delete-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        courses.splice(idx, 1);
        render();
      });
    });
    localStorage.setItem("gpaflex_semgpa_courses", JSON.stringify(courses));
  }

  tableBody.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-button");
    if (deleteBtn) return;

    const cell = e.target.closest("td");
    const row = e.target.closest("tr");
    if (!cell || !row) return;
    const rowIndex = Array.from(tableBody.children).indexOf(row);
    if (rowIndex < 0 || !courses[rowIndex]) return;
    const course = courses[rowIndex];
    const colIndex = cell.cellIndex;

    if (colIndex === 1) {
      const newTitle = window.prompt("Edit course title:", course.title || "");
      if (newTitle === null) return;
      course.title = newTitle.trim();
      render();
    } else if (colIndex === 2) {
      const newCreditsStr = window.prompt(
        "Edit credits (1, 1.5, 2, 3, 4, 5, 20):",
        String(course.credits)
      );
      if (newCreditsStr === null) return;
      const allowed = ["1", "1.5", "2", "3", "4", "5", "20"];
      if (!allowed.includes(newCreditsStr.trim())) {
        alert("Please enter one of: 1, 1.5, 2, 3, 4, 5, 20.");
        return;
      }
      const val = Number(newCreditsStr.trim());
      course.credits = val;
      course.creditsForGpa = val;
      render();
    } else if (colIndex === 3) {
      const newGradeStr = window
        .prompt("Edit grade (S, A, B, C, D, E, F, N):", course.grade)
        ?.toUpperCase();
      if (!newGradeStr) return;
      if (!Object.prototype.hasOwnProperty.call(gradeToPoints, newGradeStr)) {
        alert("Invalid grade. Use one of: S, A, B, C, D, E, F, N.");
        return;
      }
      course.grade = newGradeStr;
      render();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("#courseTitle").value.trim();
    const credits = Number($("#courseCredits").value);
    const grade = $("#courseGrade").value;

    if (!credits || !grade) return;

    courses.push({ title, credits, creditsForGpa: credits, grade });

    $("#courseTitle").value = "";
    $("#courseCredits").selectedIndex = 0;
    $("#courseGrade").selectedIndex = 0;
    render();
  });

  const resetBtn = $("#resetSemGpaBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset Semester GPA data?")) {
        courses.length = 0;
        render();
      }
    });
  }

  // Initial render to show loaded courses
  setTimeout(render, 0);
}

function setupInstantCgpa() {
  const form = $("#instantCgpaForm");
  const totalCreditsEl = $("#instantTotalCredits");
  const cgpaResultEl = $("#instantCgpaResult");
  if (!form) return;

  function calculateInstantCgpa() {
    const prevCredits = Number($("#prevCredits").value);
    const prevCgpa = Number($("#prevCgpa").value);
    const currentCredits = Number($("#currentCredits").value);
    const currentGpa = Number($("#currentGpa").value);

    if (
      isNaN(prevCredits) ||
      isNaN(prevCgpa) ||
      isNaN(currentCredits) ||
      isNaN(currentGpa)
    ) {
      return;
    }

    const totalCredits = prevCredits + currentCredits;
    const totalPoints = prevCredits * prevCgpa + currentCredits * currentGpa;
    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

    totalCreditsEl.textContent = totalCredits.toFixed(2).replace(/\.00$/, "");
    cgpaResultEl.textContent = cgpa.toFixed(2);
  }

  try {
    const saved = localStorage.getItem("gpaflex_instant_cgpa");
    if (saved) {
      const data = JSON.parse(saved);
      if (data.prevCredits) $("#prevCredits").value = data.prevCredits;
      if (data.prevCgpa) $("#prevCgpa").value = data.prevCgpa;
      if (data.currentCredits) $("#currentCredits").value = data.currentCredits;
      if (data.currentGpa) $("#currentGpa").value = data.currentGpa;
      // Auto calculate if all fields are filled
      if (data.prevCredits && data.prevCgpa && data.currentCredits && data.currentGpa) {
        calculateInstantCgpa();
      }
    }
  } catch(e) {}

  form.addEventListener("input", () => {
    const data = {
      prevCredits: $("#prevCredits").value,
      prevCgpa: $("#prevCgpa").value,
      currentCredits: $("#currentCredits").value,
      currentGpa: $("#currentGpa").value
    };
    localStorage.setItem("gpaflex_instant_cgpa", JSON.stringify(data));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    calculateInstantCgpa();
  });

  const resetBtn = $("#resetInstantCgpaBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset Instant CGPA data?")) {
        form.reset();
        totalCreditsEl.textContent = "0";
        cgpaResultEl.textContent = "0.00";
        localStorage.removeItem("gpaflex_instant_cgpa");
      }
    });
  }
}


function updateSemesterLists() {
  const users = loadUsers();
  const username = Object.keys(users)[0];
  if (!username) return;
  const all = loadSemesters();
  const list = sortSemesterList(all[username] || []);

  // Update Target List
  const targetList = document.getElementById("targetStoredSemestersList");
  if (targetList) {
    targetList.innerHTML = "";
    if (list.length === 0) {
      targetList.innerHTML =
        "<span style='color:var(--text-muted); font-size:0.8rem; padding:0.5rem;'>No stored semesters</span>";
    }
    list.forEach((sem, i) => {
      const div = document.createElement("div");
      div.className = "checkbox-item";
      div.innerHTML = `
              <input type="checkbox" id="target_sem_${i}" value="${i}">
              <label for="target_sem_${i}">
                  ${sem.term} ${sem.yearLabel} (GPA: ${sem.gpa.toFixed(
        2
      )}, Cr: ${sem.gradedCredits})
              </label>
          `;
      div.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "LABEL") {
          const cb = div.querySelector("input");
          cb.checked = !cb.checked;
        }
      });
      targetList.appendChild(div);
    });
  }

  // Update CGPA List
  const cgpaList = document.getElementById("cgpaStoredSemestersList");
  if (cgpaList) {
    cgpaList.innerHTML = "";
    if (list.length === 0) {
      cgpaList.innerHTML =
        "<span style='color:var(--text-muted); font-size:0.8rem; padding:0.5rem;'>No stored semesters</span>";
    }
    list.forEach((sem, i) => {
      const div = document.createElement("div");
      div.className = "checkbox-item";
      div.innerHTML = `
              <input type="checkbox" id="cgpa_sem_${i}" value="${i}">
              <label for="cgpa_sem_${i}">
                  ${sem.term} ${sem.yearLabel} (GPA: ${sem.gpa.toFixed(2)})
              </label>
          `;
      div.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "LABEL") {
          const cb = div.querySelector("input");
          cb.checked = !cb.checked;
        }
      });
      cgpaList.appendChild(div);
    });
  }
}

function setupCgpaBySemester() {
  const form = $("#semesterForm");
  const tableBody = $("#semestersTable tbody");
  const totalCreditsEl = $("#cgpaTotalCredits");
  const cgpaResultEl = $("#cgpaResult");
  const addBtn = document.getElementById("addSelectedToCgpaBtn");
  const listContainer = document.getElementById("cgpaStoredSemestersList");

  if (!form || !tableBody) return;

  const semesters = [];
  try {
    const saved = localStorage.getItem("gpaflex_cgpa_semesters");
    if (saved) { semesters.push(...JSON.parse(saved)); }
  } catch(e) {}

  function render() {
    tableBody.innerHTML = "";
    let totalCredits = 0;
    let totalPoints = 0;

    semesters.forEach((sem, index) => {
      const points = sem.credits * sem.gpa;
      totalCredits += sem.credits;
      totalPoints += points;
      const label = sem.label || `Sem ${index + 1}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${label}</td>
        <td>${sem.credits}</td>
        <td><span class="chip">${sem.gpa.toFixed(2)}</span></td>
        <td><button class="delete-button" data-index="${index}">✕</button></td>
      `;
      tableBody.appendChild(tr);
    });

    const cgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
    totalCreditsEl.textContent = totalCredits.toFixed(2).replace(/\.00$/, "");
    cgpaResultEl.textContent = cgpa.toFixed(2);

    tableBody.querySelectorAll(".delete-button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        semesters.splice(idx, 1);
        render();
      });
    });
    localStorage.setItem("gpaflex_cgpa_semesters", JSON.stringify(semesters));
  }

  tableBody.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-button");
    if (deleteBtn) return;

    const cell = e.target.closest("td");
    const row = e.target.closest("tr");
    if (!cell || !row) return;
    const rowIndex = Array.from(tableBody.children).indexOf(row);
    if (rowIndex < 0 || !semesters[rowIndex]) return;
    const sem = semesters[rowIndex];
    const colIndex = cell.cellIndex;

    if (colIndex === 1) {
      const currentLabel = sem.label || `Sem ${rowIndex + 1}`;
      const newLabel = window.prompt("Edit semester label:", currentLabel);
      if (newLabel === null) return;
      sem.label = newLabel.trim();
      render();
    } else if (colIndex === 2) {
      const newCreditsStr = window.prompt(
        "Edit total credits for this semester:",
        String(sem.credits)
      );
      if (newCreditsStr === null) return;
      const newCredits = Number(newCreditsStr);
      if (!newCredits || Number.isNaN(newCredits) || newCredits < 0) {
        alert("Please enter a valid positive number for credits.");
        return;
      }
      sem.credits = newCredits;
      render();
    } else if (colIndex === 3) {
      const newGpaStr = window.prompt(
        "Edit GPA for this semester:",
        String(sem.gpa)
      );
      if (newGpaStr === null) return;
      const newGpa = Number(newGpaStr);
      if (Number.isNaN(newGpa) || newGpa < 0 || newGpa > 10) {
        alert("Please enter a valid GPA between 0 and 10.");
        return;
      }
      sem.gpa = newGpa;
      render();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const label = $("#semesterLabel").value.trim();
    const credits = Number($("#semesterCredits").value);
    const gpa = Number($("#semesterGpa").value);
    if (!credits || !gpa) return;

    semesters.push({ label, credits, gpa });
    $("#semesterLabel").value = "";
    $("#semesterCredits").value = "";
    $("#semesterGpa").value = "";
    render();
  });

  if (addBtn && listContainer) {
    addBtn.addEventListener("click", () => {
      if (isGuest) {
        alert("Please sign in to add your stored semesters to CGPA. Guests can only use manual entry.");
        return;
      }
      const all = loadSemesters();
      const users = loadUsers();
      const username = Object.keys(users)[0];
      if (!username) return;
      const list = sortSemesterList(all[username] || []);

      const checkboxes = listContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      checkboxes.forEach((cb) => {
        const idx = parseInt(cb.value);
        if (list[idx]) {
          const sem = list[idx];
          
          // Add fallbacks for legacy data missing gradedCredits or gpa
          const courses = sem.courses || [];
          const gradedCredits = typeof sem.gradedCredits === 'number' ? sem.gradedCredits : courses.filter(c => !c.isOnline).reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
          const gpa = typeof sem.gpa === 'number' ? sem.gpa : 0;
          
          if (gradedCredits > 0) {
            const label = `${sem.term || ""} ${sem.yearLabel || ""}`.trim();
            const isDuplicate = semesters.some((s) => s.label === label);
            if (!isDuplicate) {
              semesters.push({
                label: label,
                credits: gradedCredits,
                gpa: gpa,
              });
            } else {
              alert(`Semester '${label}' is already added!`);
            }
          }
        }
        cb.checked = false;
      });
      render();
    });
  }

  const resetBtn = $("#resetCgpaBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset CGPA by Semester data?")) {
        semesters.length = 0;
        render();
      }
    });
  }

  // Initial render to show loaded semesters
  setTimeout(render, 0);
}

function setupTargetGpaCalculator() {
  const storedForm = $("#targetGpaFormStored");
  const manualForm = $("#targetGpaFormManual");
  const resultContainer = $("#targetResultContainer");
  const resultGpa = $("#targetResultGpa");
  const resultStatus = $("#targetResultStatus");

  function calculateTargetGpa(
    desiredCgpa,
    completedCredits,
    currentCgpa,
    currentSemCredits
  ) {
    if (currentSemCredits === 0) {
      return null;
    }
    const wantedGpa =
      (desiredCgpa * (completedCredits + currentSemCredits) -
        currentCgpa * completedCredits) /
      currentSemCredits;
    return wantedGpa;
  }

  function showResult(gpa) {
    resultGpa.textContent = gpa.toFixed(2);

    if (gpa > 10) {
      resultStatus.textContent = "🔴 Impossible (GPA > 10)";
      resultStatus.style.color = "var(--danger)";
    } else if (gpa < 0) {
      resultStatus.textContent = "🟢 Already achieved";
      resultStatus.style.color = "var(--accent)";
    } else if (gpa >= 9) {
      resultStatus.textContent = "🟠 Very challenging";
      resultStatus.style.color = "var(--accent-strong)";
    } else if (gpa >= 7) {
      resultStatus.textContent = "🟡 Challenging";
      resultStatus.style.color = "var(--accent-strong)";
    } else {
      resultStatus.textContent = "🟢 Achievable";
      resultStatus.style.color = "var(--accent)";
    }

    resultContainer.classList.remove("hidden");
  }

  if (storedForm) {
    storedForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const listContainer = document.getElementById(
        "targetStoredSemestersList"
      );
      const checkboxes = listContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      );

      if (checkboxes.length === 0) {
        alert("Please select at least one semester.");
        return;
      }

      const all = loadSemesters();
      const users = loadUsers();
      const username = Object.keys(users)[0];
      if (!username) return;
      const list = sortSemesterList(all[username] || []);

      let totalGradedCredits = 0;
      let totalPoints = 0;

      checkboxes.forEach((cb) => {
        const idx = parseInt(cb.value);
        if (list[idx]) {
          const sem = list[idx];
          totalGradedCredits += sem.gradedCredits;
          totalPoints += sem.gradedCredits * sem.gpa;
        }
      });

      const currentCgpa =
        totalGradedCredits > 0 ? totalPoints / totalGradedCredits : 0;
      const completedCredits = totalGradedCredits;

      const desiredCgpa = Number($("#targetCgpaDesired").value);
      const currentSemCredits = Number($("#targetCurrentSemCredits").value);

      if (isNaN(desiredCgpa) || isNaN(currentSemCredits)) return;

      const wantedGpa = calculateTargetGpa(
        desiredCgpa,
        completedCredits,
        currentCgpa,
        currentSemCredits
      );
      if (wantedGpa === null) return;
      showResult(wantedGpa);
    });
  }

  if (manualForm) {
    manualForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const currentCgpa = Number($("#targetCurrentCgpa").value);
      const completedCredits = Number($("#targetCompletedCredits").value);
      const desiredCgpa = Number($("#targetDesiredCgpaManual").value);
      const currentSemCredits = Number(
        $("#targetCurrentSemCreditsManual").value
      );

      if (
        isNaN(currentCgpa) ||
        isNaN(completedCredits) ||
        isNaN(desiredCgpa) ||
        isNaN(currentSemCredits)
      )
        return;

      const wantedGpa = calculateTargetGpa(
        desiredCgpa,
        completedCredits,
        currentCgpa,
        currentSemCredits
      );
      if (wantedGpa === null) return;
      showResult(wantedGpa);
    });
  }

  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach((tab) => {
        tab.classList.remove("active");
      });
      document.querySelectorAll(".tab-btn").forEach((b) => {
        b.classList.remove("tab-btn-active");
      });
      document.getElementById(tabId)?.classList.add("active");
      btn.classList.add("tab-btn-active");
    });
  });

  try {
    const saved = localStorage.getItem("gpaflex_target_gpa");
    if (saved) {
      const data = JSON.parse(saved);
      if (data.targetCgpaDesired) $("#targetCgpaDesired").value = data.targetCgpaDesired;
      if (data.targetCurrentSemCredits) $("#targetCurrentSemCredits").value = data.targetCurrentSemCredits;
      if (data.targetCurrentCgpa) $("#targetCurrentCgpa").value = data.targetCurrentCgpa;
      if (data.targetCompletedCredits) $("#targetCompletedCredits").value = data.targetCompletedCredits;
      if (data.targetDesiredCgpaManual) $("#targetDesiredCgpaManual").value = data.targetDesiredCgpaManual;
      if (data.targetCurrentSemCreditsManual) $("#targetCurrentSemCreditsManual").value = data.targetCurrentSemCreditsManual;
    }
  } catch(e) {}

  const cardNode = document.getElementById("targetGpaCard");
  if (cardNode) {
    cardNode.addEventListener("input", () => {
      const data = {
        targetCgpaDesired: $("#targetCgpaDesired").value,
        targetCurrentSemCredits: $("#targetCurrentSemCredits").value,
        targetCurrentCgpa: $("#targetCurrentCgpa").value,
        targetCompletedCredits: $("#targetCompletedCredits").value,
        targetDesiredCgpaManual: $("#targetDesiredCgpaManual").value,
        targetCurrentSemCreditsManual: $("#targetCurrentSemCreditsManual").value
      };
      localStorage.setItem("gpaflex_target_gpa", JSON.stringify(data));
    });
  }

  const resetBtn = $("#resetTargetGpaBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset Target GPA Calculator data?")) {
        if (storedForm) storedForm.reset();
        if (manualForm) manualForm.reset();
        resultContainer.classList.add("hidden");
        localStorage.removeItem("gpaflex_target_gpa");
        const listContainer = document.getElementById("targetStoredSemestersList");
        if (listContainer) {
          listContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
      }
    });
  }
}

function setupThemeToggle() {
  const toggle = $("#themeToggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function setupFeatureNav() {
  const tabs = document.querySelectorAll(".feature-tab");
  const cardIds = [
    "gpaCalcCard",
    "instantCgpaCard",
    "cgpaBySemCard",
    "targetGpaCard",
    "importCard",
  ];
  let currentIndex = 0;

  function switchCard(targetId) {
    cardIds.forEach((id, index) => {
      const card = document.getElementById(id);
      if (!card) return;
      if (id === targetId) {
        card.classList.remove("hidden");
        currentIndex = index;
      } else {
        card.classList.add("hidden");
      }
    });

    // Update active tab styles and scroll it into view if nav is scrollable
    tabs.forEach((tab) => {
      if (tab.getAttribute("data-target") === targetId) {
        tab.classList.add("feature-tab-active");
        tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } else {
        tab.classList.remove("feature-tab-active");
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-target");
      if (!target) return;
      switchCard(target);
    });
  });

  // Touch Swipe Logic
  let touchStartX = 0;
  let touchStartY = 0;

  document.body.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.body.addEventListener("touchend", (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    
    // Detect horizontal swipe
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      // Check if the user is swiping inside a horizontal scrollable area (like a table)
      const targetElement = e.target;
      if (targetElement.closest('.table-wrapper') || targetElement.closest('.checkbox-list')) {
         // Don't switch tabs if the user is scrolling a table horizontally
         return;
      }
      
      if (dx < 0) {
        // Swipe Left -> Next tab
        if (currentIndex < cardIds.length - 1) {
          switchCard(cardIds[currentIndex + 1]);
        }
      } else {
        // Swipe Right -> Prev tab
        if (currentIndex > 0) {
          switchCard(cardIds[currentIndex - 1]);
        }
      }
    }
  }, { passive: true });

  switchCard("gpaCalcCard");
}

function setupImportCard() {
  const form = document.getElementById("importForm");
  const semesterSelect = document.getElementById("semesterSelect");
  const rawArea = document.getElementById("rawTranscript");
  const tableBody = document.querySelector("#storedSemestersTable tbody");
  if (!form || !semesterSelect || !rawArea || !tableBody) return;

  const now = new Date();
  let currentYear = now.getFullYear();
  // Academic year increments in June (month index 5)
  if (now.getMonth() < 5) {
    currentYear -= 1;
  }

  const count = 8;
  semesterSelect.innerHTML = '<option value="" disabled selected>-- Choose Semester --</option>';

  for (let i = 0; i < count; i += 1) {
    const start = currentYear - i;
    const label = `${start}-${String(start + 1).slice(-2)}`;
    
    let terms = ["Summer", "Winter", "Fall"];
    if (i === 0) {
      const month = now.getMonth();
      if (month >= 5 && month < 10) {
        // June to October: Only Fall has started
        terms = ["Fall"];
      } else if (month >= 10 || month < 4) {
        // November to April (next year): Winter has started
        terms = ["Winter", "Fall"];
      } else if (month === 4) {
        // May: Summer has started
        terms = ["Summer", "Winter", "Fall"];
      }
    }
    
    terms.forEach(term => {
        const opt = document.createElement("option");
        opt.value = `${term}_${label}`;
        opt.textContent = `${term} Semester ${label}`;
        semesterSelect.appendChild(opt);
    });
  }

  function renderStored() {
    const users = loadUsers();
    const username = Object.keys(users)[0];
    if (!username) return;
    const all = loadSemesters();
    let list = all[username] || [];
    
    tableBody.innerHTML = "";
    list.forEach((sem, idx) => {
      const tr = document.createElement("tr");
      tr.setAttribute("draggable", "true");
      tr.setAttribute("data-index", idx);
      
      const courses = sem.courses || [];
      const totalCredits = typeof sem.totalCredits === 'number' ? sem.totalCredits : courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
      const gradedCredits = typeof sem.gradedCredits === 'number' ? sem.gradedCredits : courses.filter(c => !c.isOnline).reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
      const gpa = typeof sem.gpa === 'number' ? sem.gpa : 0;
      
      tr.innerHTML = `
        <td style="cursor: grab;">☰ ${idx + 1}</td>
        <td>${sem.term || "-"}</td>
        <td>${sem.yearLabel || "-"}</td>
        <td>${courses.length}</td>
        <td>${totalCredits.toFixed(2).replace(/\.00$/, "")}</td>
        <td>${gradedCredits.toFixed(2).replace(/\.00$/, "")}</td>
        <td>${gpa.toFixed(2)}</td>
        <td>
          <div class="action-buttons">
            <button class="view-details-btn" data-index="${idx}">View</button>
            <button class="delete-semester-btn" data-index="${idx}" title="Delete semester">✕</button>
          </div>
        </td>
      `;
      
      // Drag Events
      tr.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", idx);
          e.dataTransfer.effectAllowed = "move";
          tr.style.opacity = "0.5";
      });
      
      tr.addEventListener("dragend", () => {
          tr.style.opacity = "1";
          document.querySelectorAll("tr").forEach(row => row.classList.remove("drag-over"));
      });
      
      tr.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          tr.classList.add("drag-over");
      });
      
      tr.addEventListener("dragleave", () => {
          tr.classList.remove("drag-over");
      });
      
      tr.addEventListener("drop", (e) => {
          e.preventDefault();
          const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
          const toIdx = idx;
          
          if (fromIdx !== toIdx) {
              // Reorder
              const item = list.splice(fromIdx, 1)[0];
              list.splice(toIdx, 0, item);
              
              all[username] = list;
              saveSemesters(all);
              renderStored();
          }
      });
      
      tableBody.appendChild(tr);
    });

    updateSemesterLists();
  }

  // Event Delegation for the action buttons (View / Delete) attached to the table body
  // This ensures they work even if rows are dynamically added/removed or if there's a rendering error elsewhere
  tableBody.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".view-details-btn");
    const deleteBtn = e.target.closest(".delete-semester-btn");
    
    if (viewBtn) {
      const idx = Number(viewBtn.getAttribute("data-index"));
      const all = loadSemesters();
      const username = getCurrentUsername();
      const list = all[username] || [];
      if (idx >= 0 && idx < list.length) {
        showSemesterDetails(list[idx]);
      }
    } else if (deleteBtn) {
      const idx = Number(deleteBtn.getAttribute("data-index"));
      const all = loadSemesters();
      const username = getCurrentUsername();
      const list = all[username] || [];
      if (idx >= 0 && idx < list.length) {
        const sem = list[idx];
        const confirmMsg = `Are you sure you want to delete ${sem.term} ${sem.yearLabel}?\n\nThis will remove all ${sem.courses.length} courses from this semester.`;
        if (confirm(confirmMsg)) {
          deleteStoredSemester(idx);
        }
      }
    }
  });

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
    
    // Find column indices with multiple pattern options
    const idxCode = findColumnIndex(headerCols, ["course code", "code"]);
    const idxTitle = findColumnIndex(headerCols, ["course title", "title"]);
    // Type and Credits indices are less reliable, we use heuristics.
    const idxTotal = findColumnIndex(headerCols, ["grand total", "total", "marks"]);
    const idxGrade = findColumnIndex(headerCols, ["grade"]);
    
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
      
      const knownTypes = ["Theory Only", "Lab Only", "Embedded Theory and Lab", "Soft Skill", "Online Course", "Project"];
      
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
      } else if (idxTitle !== -1 && idxTitle > codeIndex && idxTitle < parts.length) {
          title = parts[idxTitle];
      } else {
           if (parts[codeIndex+1]) title = parts[codeIndex+1];
      }

      // Clean Title if Type was merged into it (common in single-space pastes)
      if (typeIndex === -1 || (typeIndex === codeIndex+1 && type.includes(title))) {
           // Heuristic: check if 'type' content (or title content) matches a known type
           const checkStr = typeIndex === -1 ? title : type;
           for (const kt of knownTypes) {
               if (checkStr.toLowerCase().includes(kt.toLowerCase())) {
                   type = kt;
                   const regex = new RegExp(kt, "i");
                   title = checkStr.replace(regex, "").trim();
                   // If we found type in the title/merged string, set typeIndex effectively to where title is
                   if (typeIndex === -1) typeIndex = codeIndex + 1; 
                   break;
               }
           }
      }

      // 4. Identify Credits using pattern matching (L P J C pattern)
      // Robust strategy: Find first sequence of 4 numbers after the Code
      let credits = 0;
      let lpjcFound = false;
      
      // Search window: Start after Code/Title. 
      // Safe start: codeIndex + 1.
      for(let j=codeIndex+1; j <= parts.length - 4; j++) {
          const v1 = Number(parts[j]);
          const v2 = Number(parts[j+1]);
          const v3 = Number(parts[j+2]);
          const v4 = Number(parts[j+3]);
          
          if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3) && !isNaN(v4)) {
               // Found L P J C block
               credits = v4;
               lpjcFound = true;
               break;
          }
      }
      
      // Fallback
      if (!lpjcFound && typeIndex !== -1 && typeIndex + 4 < parts.length) {
           const val = Number(parts[typeIndex + 4]);
           if (!isNaN(val)) credits = val;
      }
      
      // 5. Total Marks extraction
      let total = 0;
      if (idxTotal !== -1 && idxTotal < parts.length) {
           const val = Number(parts[idxTotal]);
           if (!isNaN(val)) total = val;
      }
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
          courses.push({
            code,
            title,
            type,
            credits,
            total,
            grade,
            isOnline,
          });
      }
    }

    if (!courses.length) {
      return null;
    }

    // compute total credits (all courses) and graded credits (excluding online/pass-fail)
    let totalCredits = 0;
    let gradedCredits = 0;
    let totalPoints = 0;
    courses.forEach((c) => {
      totalCredits += c.credits; // Count all credits
      if (c.isOnline) return; // Skip online/pass-fail for GPA calculation
      const gp = gradeToPoints[c.grade] ?? 0;
      gradedCredits += c.credits;
      totalPoints += c.credits * gp;
    });
    const gpa = gradedCredits > 0 ? totalPoints / gradedCredits : 0;

    return { courses, totalCredits, gradedCredits, gpa };
  }

  function parseRegistrationText(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l);
    const courses = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip non-data lines
        if (/^sl\.?no/i.test(line) || /^L\s+P\s+J\s+C/i.test(line)) continue;
        if (line.toLowerCase().startsWith("gpa")) continue;
        
        let parts = [];
        if (line.includes("\t")) {
            parts = line.split("\t");
        } else {
            // Split by 2+ spaces to separate columns
            parts = line.split(/\s{2,}/);
        }
        
        const cleanParts = parts.map(p => p.trim()).filter(p => p);
        
        // We need at least Code, Title, Credits, Grade
        if (cleanParts.length < 5) continue;
        
        // 1. Identify Course Code (usually index 1)
        const codeIdx = cleanParts.findIndex(p => /^[A-Z]{3,4}\d{3,4}[A-Z]?$/i.test(p));
        if (codeIdx === -1) continue; 
        
        const code = cleanParts[codeIdx];
        
        // 2. Identify Course Type (Theory Only etc.)
        const typeIdx = cleanParts.findIndex((p, idx) => 
            idx > codeIdx && /theory|lab|embedded|online|soft|project/i.test(p)
        );
        
        let type = "Theory";
        if (typeIdx !== -1) type = cleanParts[typeIdx];
        
        // 3. Identify Title (Between Code and Type)
        let title = "";
        if (typeIdx > codeIdx + 1) {
            title = cleanParts.slice(codeIdx + 1, typeIdx).join(" ");
        } else {
             if (cleanParts[codeIdx + 1]) title = cleanParts[codeIdx + 1];
        }
        
        let credits = 0;
        let totalMarks = "-";
        let grade = "N";

        // Registration parsing was not reported as broken. Leaving as is but fixing grade fallback.
        
        if (typeIdx !== -1) {
            // Credits is in the 'C' column (part of L P J C block)
            // Scan for 4 consecutive numbers starting after typeIdx
            let lpjcFound = false;
            for (let j = typeIdx + 1; j <= cleanParts.length - 4; j++) {
                const v1 = parseFloat(cleanParts[j]);
                const v2 = parseFloat(cleanParts[j+1]);
                const v3 = parseFloat(cleanParts[j+2]);
                const v4 = parseFloat(cleanParts[j+3]);
                
                if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3) && !isNaN(v4)) {
                    credits = v4;
                    lpjcFound = true;
                    break;
                }
            }
            // Fallback if sequence not found
            if (!lpjcFound && cleanParts[typeIdx + 4]) {
                 const val = parseFloat(cleanParts[typeIdx + 4]);
                 if (!isNaN(val)) credits = val;
            }
            
            // Start look for Grade from the end
             for (let j = cleanParts.length - 1; j > typeIdx; j--) {
                const p = cleanParts[j].trim().toUpperCase();
                if (/^[SABCDEFNP]$/.test(p)) {
                     grade = p;
                     // Total Marks is usually immediately before Grade
                     if (cleanParts[j-1] && /^\d+(\.\d+)?$/.test(cleanParts[j-1])) {
                         totalMarks = cleanParts[j-1];
                     }
                     break;
                }
            }
        }
        
        // New isOnline logic here too
        if (code && title) { 
             const isOnline = ["P", "N", "F", "NULL", "-"].includes(grade.toUpperCase());
             courses.push({
                code: code,
                title: title,
                credits: credits,
                grade: grade,
                totalMarks: totalMarks,
                type: type,
                isOnline: isOnline
            });
        }
    }

    if (courses.length === 0) return null;

    // Calculate totals
    let totalCredits = 0;
    let gradedCredits = 0;
    let totalPoints = 0;
    courses.forEach((c) => {
        totalCredits += c.credits;
        if (c.isOnline) return;
        const gp = gradeToPoints[c.grade] ?? 0;
        gradedCredits += c.credits;
        totalPoints += c.credits * gp;
    });
    const gpa = gradedCredits > 0 ? totalPoints / gradedCredits : 0;
    return { courses, totalCredits, gradedCredits, gpa };
  }

  function showSemesterDetails(sem) {
    if (!sem) return;

    // Fallbacks for semester metrics to handle legacy data safely
    const courses = sem.courses || [];
    const totalCredits = typeof sem.totalCredits === 'number' ? sem.totalCredits : courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const gradedCredits = typeof sem.gradedCredits === 'number' ? sem.gradedCredits : courses.filter(c => !c.isOnline).reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const gpa = typeof sem.gpa === 'number' ? sem.gpa : 0;

    // Sort courses: Theory -> Embedded -> Lab -> Soft Skill -> Others
    const typeOrder = {
      "Theory Only": 1,
      "Theory": 1,
      "Embedded Theory and Lab": 2,
      "Lab Only": 3,
      "Soft Skill": 4,
      "Online Course": 5
    };
    
    const sortedCourses = [...courses].sort((a, b) => {
      const orderA = typeOrder[a.type] || (a.isOnline ? 5 : 99);
      const orderB = typeOrder[b.type] || (b.isOnline ? 5 : 99);
      return orderA - orderB;
    });

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${sem.term || "Semester"} ${sem.yearLabel || ""}</h3>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="summary">
            <div class="summary-item">
              <span class="summary-label">Total Courses:</span>
              <span class="summary-value">${courses.length}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Total Credits:</span>
              <span class="summary-value">${totalCredits.toFixed(2).replace(/\.00$/, "")}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Graded Credits:</span>
              <span class="summary-value">${gradedCredits.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">GPA:</span>
              <span class="summary-value highlight">${gpa.toFixed(2)}</span>
            </div>
          </div>
          <div class="table-wrapper" style="margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Type</th>
                  <th>Credits</th>
                  <th>Mark</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${sortedCourses
                  .map((c, i) => {
                    const grade = c.grade || "N";
                    const credits = Number(c.credits) || 0;
                    const rowClass = c.isOnline ? "online-course" : "";
                    return `
                    <tr class="${rowClass}">
                      <td>${i + 1}</td>
                      <td>${c.code || "-"}</td>
                      <td>${c.title || "-"}</td>
                      <td>${c.type || "-"}</td>
                      <td>${credits.toFixed(1)}</td>
                      <td>${c.total || c.totalMarks || "-"}</td>
                      <td><span class="chip ${
                        c.isOnline ? "danger-chip" : ""
                      }">${grade}</span></td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    const closeBtn = modal.querySelector(".modal-close");
    const closeModal = () => {
      document.body.removeChild(modal);
      document.body.style.overflow = '';
    };

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isGuest) {
      alert("Please sign in to store and import semester data. Guest mode only allows manual entry.");
      return;
    }
    const username = getCurrentUsername();
    if (!username) {
      alert("Please sign in first to store semester data.");
      return;
    }
    
    if (!semesterSelect.value) return;
    const [term, yearLabel] = semesterSelect.value.split("_");
    const text = rawArea.value.trim();
    if (!term || !yearLabel || !text) return;

    // Try both parsers
    const parsed = parseRegistrationText(text) || parseTranscript(text);
    
    if (!parsed || parsed.courses.length === 0) {
        alert("Could not parse any courses. Please check the text format.");
        return;
    }

    // New Fix: Ensure the user sees the parsed data before saving if debug needed, or just trust the new parser.
    // The previous logic had issues with Lab credits being 0.
    // Let's explicitly log the parsed courses for debugging if the user opens console.
    console.log("Parsed Courses:", parsed.courses);

    const all = loadSemesters();
    // Use a fresh reference to the array to avoid any reference issues
    // Key fix for "vanishing" semesters: ensure we are modifying the *saved* array
    // and re-saving it completely.
    let userSemesters = all[username] || [];
    
    // Remove existing entry if it matches term/year
    const existingIndex = userSemesters.findIndex(
      (s) => s.term === term && s.yearLabel === yearLabel
    );
    
    const newRecord = {
      term,
      yearLabel,
      courses: parsed.courses,
      totalCredits: parsed.totalCredits,
      gradedCredits: parsed.gradedCredits,
      gpa: parsed.gpa,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      userSemesters[existingIndex] = newRecord;
    } else {
      userSemesters.push(newRecord);
    }
    
    // Update the master object and save
    all[username] = sortSemesterList(userSemesters);
    saveSemesters(all);
    
    rawArea.value = "";
    renderStored();
    alert("Semester data saved successfully.");
  });

  function deleteStoredSemester(index) {
    const username = getCurrentUsername();
    if (!username) return;

    const all = loadSemesters();
    const list = all[username] || [];
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
      all[username] = list;
      saveSemesters(all);
      renderStored();
    }
  }

  renderStored();
}

function setupPwa() {
  const installBtn = $("#installBtn");
  if (!installBtn) return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          deferredPrompt = null;
        }
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
          alert("To install on iOS: Tap the 'Share' icon at the bottom of Safari, then tap 'Add to Home Screen'.");
        } else {
          alert("To install as an app: Tap your browser's menu (⋮) and select 'Add to Home screen' or 'Install app'. Ensure you are viewing this in a standard browser like Chrome.");
        }
      }
    });
  }
}

function ensureDefaultUser() {
  const users = loadUsers();
  if (Object.keys(users).length === 0) {
    users["student"] = {
      password: "password123",
      provider: "password",
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ensureDefaultUser();
  initTheme();
  setupThemeToggle();
  setupFeatureNav();
  setupGpaCalculator();
  setupInstantCgpa();
  setupCgpaBySemester();
  setupTargetGpaCalculator();
  setupImportCard();
  updateSemesterLists();
  setupPwa();
});
