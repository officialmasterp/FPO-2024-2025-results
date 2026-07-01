/**
 * Federal Polytechnic Oko — Student Result Portal
 * app.js — All search, render, chart, PDF, and print logic
 * Data source: data.js (RESULT_DATA)
 */

'use strict';

// ─── GRADING TABLES (from Settings & Grading sheet) ──────────────────────────
const GRADE_SCALE = [
  { min: 70, max: 100, grade: 'A', gp: 5, remark: 'Excellent' },
  { min: 60, max: 69,  grade: 'B', gp: 4, remark: 'Very Good' },
  { min: 50, max: 59,  grade: 'C', gp: 3, remark: 'Good' },
  { min: 45, max: 49,  grade: 'D', gp: 2, remark: 'Fair' },
  { min: 40, max: 44,  grade: 'E', gp: 1, remark: 'Pass' },
  { min: 0,  max: 39,  grade: 'F', gp: 0, remark: 'Fail' },
];

const DEGREE_CLASS = [
  { min: 4.50, max: 5.00, label: 'First Class' },
  { min: 3.50, max: 4.49, label: 'Second Class Upper' },
  { min: 2.40, max: 3.49, label: 'Second Class Lower' },
  { min: 1.50, max: 2.39, label: 'Third Class' },
  { min: 1.00, max: 1.49, label: 'Pass' },
  { min: 0.00, max: 0.99, label: 'Fail / Withdrawn' },
];

const STANDING_RULES = [
  { min: 3.50, label: 'Good Standing',         cls: 'standing-good' },
  { min: 2.00, label: 'Satisfactory Standing', cls: 'standing-satisfactory' },
  { min: 1.00, label: 'Probation',             cls: 'standing-probation' },
  { min: 0.00, label: 'Withdrawal Risk',       cls: 'standing-withdrawal' },
];

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
let currentStudent = null;
let chartsBuilt = false;
let progressChart = null;
let gradeChart = null;
let cgpaChart = null;
let searchMode = 'matric'; // 'matric' | 'name'

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateHeroStats();
  buildAdminTables();
  setupThemeToggle();

  // Enter key on search
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') performSearch();
  });
});

// ─── HERO STATS ───────────────────────────────────────────────────────────────
function updateHeroStats() {
  const students = RESULT_DATA.students;
  const total = students.length;
  const avgCgpa = (students.reduce((s, st) => s + (st.annual.cgpa || 0), 0) / total).toFixed(2);
  const pass = students.filter(st => (st.annual.cgpa || 0) >= 1.0).length;
  const passRate = Math.round((pass / total) * 100);

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pass').textContent = passRate + '%';
  document.getElementById('stat-avg').textContent = avgCgpa;
}

// ─── SEARCH MODE ──────────────────────────────────────────────────────────────
function setSearchMode(mode) {
  searchMode = mode;
  document.querySelectorAll('.search-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const inp = document.getElementById('search-input');
  const lbl = document.getElementById('search-field-label');
  if (mode === 'matric') {
    inp.placeholder = 'e.g. FPO/CV/HA/23/001';
    lbl.textContent = 'Matric Number';
  } else {
    inp.placeholder = 'e.g. NWANKWODILI Chinemezu';
    lbl.textContent = 'Student Full Name';
  }
  inp.value = '';
  inp.focus();
}

// ─── PERFORM SEARCH ───────────────────────────────────────────────────────────
function performSearch() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  const errBox = document.getElementById('search-error');

  errBox.classList.add('hidden');
  if (!query) {
    showError('Please enter a Matric Number or Name to continue.');
    return;
  }

  // Show loading briefly for UX
  document.getElementById('loading-screen').style.display = 'block';
  document.getElementById('landing-section').style.display = 'none';

  setTimeout(() => {
    const found = searchMode === 'matric'
      ? RESULT_DATA.students.find(s =>
          s.matric.toLowerCase().replace(/\//g, '') === query.replace(/\//g, '') ||
          s.matric.toLowerCase() === query)
      : RESULT_DATA.students.find(s => s.name.toLowerCase().includes(query));

    document.getElementById('loading-screen').style.display = 'none';

    if (!found) {
      document.getElementById('landing-section').style.display = 'block';
      showError(`No record found for "<strong>${escHtml(query)}</strong>". Check your ${searchMode === 'matric' ? 'Matric Number' : 'name'} and try again.`);
      return;
    }

    currentStudent = found;
    loadDashboard(found);
  }, 500);
}

function showError(msg) {
  const errBox = document.getElementById('search-error');
  errBox.innerHTML = '⚠️ ' + msg;
  errBox.classList.remove('hidden');
}

// ─── LOAD DASHBOARD ───────────────────────────────────────────────────────────
function loadDashboard(s) {
  // Update sidebar
  const initials = s.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('');
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = titleCase(s.name);
  document.getElementById('sidebar-matric').textContent = s.matric;

  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('portal-nav').classList.remove('hidden');

  // Build all views
  buildProfile(s);
  buildSemesterResult(s, 's1');
  buildSessionResult(s);
  buildTranscript(s);
  buildCourseReg(s);
  buildGpaCalc(s);
  buildProgress(s);

  // Show dashboard
  document.getElementById('dashboard').classList.add('show');
  document.getElementById('landing-section').style.display = 'none';

  // Charts need DOM first
  setTimeout(() => {
    if (!chartsBuilt) {
      buildCohortCharts();
      buildCohortStats();
      chartsBuilt = true;
    }
  }, 100);

  // Jump to profile
  showView('view-profile', document.querySelector('.sidebar-link[data-view="view-profile"]'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
function logout() {
  currentStudent = null;
  chartsBuilt = false;
  document.getElementById('dashboard').classList.remove('show');
  document.getElementById('landing-section').style.display = 'block';
  document.getElementById('portal-nav').classList.add('hidden');
  document.getElementById('logout-btn').classList.add('hidden');
  document.getElementById('search-input').value = '';
  document.getElementById('search-error').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── VIEW SWITCHING ───────────────────────────────────────────────────────────
function showView(viewId, btn) {
  document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  if (btn) btn.classList.add('active');

  // Lazy-render semester result when tab changes
  if (viewId === 'view-semester') renderSemesterResult();
  if (viewId === 'view-progress') buildProgressChart(currentStudent);
}

// ─── BUILD PROFILE ────────────────────────────────────────────────────────────
function buildProfile(s) {
  const degClass = getDegClass(s.annual.cgpa);
  const standing = getStanding(s.annual.cgpa);

  document.getElementById('profile-info-grid').innerHTML = [
    ['Full Name',       titleCase(s.name)],
    ['Matric Number',   s.matric],
    ['Gender',          s.gender],
    ['Date of Birth',   s.dob === 'None' ? '—' : s.dob],
    ['Department',      s.department],
    ['Faculty',         s.faculty],
    ['Programme',       s.programme],
    ['Level',           s.level],
    ['Session',         s.session],
    ['State of Origin', s.state],
    ['Phone',           s.phone],
    ['Email',           s.email],
  ].map(([l, v]) => `<div class="info-item"><div class="lbl">${l}</div><div class="val">${v || '—'}</div></div>`).join('');

  document.getElementById('profile-stat-grid').innerHTML = [
    ['1st Sem GPA',   fmt2(s.annual.sem1_gpa), false],
    ['2nd Sem GPA',   fmt2(s.annual.sem2_gpa), false],
    ['CGPA',          fmt2(s.annual.cgpa),      true],
    ['Total Units',   s.annual.total_units,     false],
    ['Quality Points',s.annual.total_qp,        false],
    ['Position',      ordinal(s.position || '—'), false],
  ].map(([l, v, gold]) =>
    `<div class="stat-box${gold ? ' gold' : ''}"><div class="v">${v}</div><div class="l">${l}</div></div>`
  ).join('');

  document.getElementById('profile-standing-banner').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:8px;">
      <span class="standing-badge ${standing.cls}">${standing.icon} ${standing.label}</span>
      <span class="standing-badge" style="background:var(--gold-100);color:var(--gold-600);">🏆 ${degClass}</span>
      ${s.position ? `<span class="standing-badge" style="background:var(--slate-100);color:var(--slate-700);">🎖 Ranked ${ordinal(s.position)} / ${RESULT_DATA.students.length}</span>` : ''}
    </div>`;
}

// ─── SEMESTER RESULT SLIP ─────────────────────────────────────────────────────
function buildSemesterResult(s, key) {
  // pre-fill both so switching is instant
  ['s1', 's2'].forEach(k => renderSlip(s, k, `slip-${k}`));
}

function renderSemesterResult() {
  const key = document.getElementById('semester-select').value;
  const s1El = document.getElementById('slip-s1');
  const s2El = document.getElementById('slip-s2');
  if (s1El) s1El.style.display = key === 's1' ? 'block' : 'none';
  if (s2El) s2El.style.display = key === 's2' ? 'block' : 'none';
}

function renderSlip(s, semKey, containerId) {
  const isSem1 = semKey === 's1';
  const semData = isSem1 ? s.s1 : s.s2;
  const semLabel = isSem1 ? 'First Semester' : 'Second Semester';
  const courses = isSem1 ? RESULT_DATA.courses_sem1 : RESULT_DATA.courses_sem2;
  const meta = RESULT_DATA.meta;
  const verifyCode = `FPO-${s.matric.split('/').pop()}-${isSem1 ? 'S1' : 'S2'}-2425`;

  // Build rows
  const rows = courses.map(c => {
    const sc = semData.courses[c.code] || {};
    const total = sc.total ?? '—';
    const grade = sc.grade ?? '—';
    const gp = sc.gp ?? '—';
    const qp = (typeof gp === 'number' && c.unit) ? gp * c.unit : '—';
    const isFail = grade === 'F';
    return `<tr>
      <td>${c.code}</td>
      <td>${c.title}${isFail ? '<span class="carryover-tag">Carry-Over</span>' : ''}</td>
      <td style="text-align:center">${c.unit}</td>
      <td style="text-align:center">${sc.ca ?? '—'}</td>
      <td style="text-align:center">${sc.exam ?? '—'}</td>
      <td style="text-align:center"><strong>${total}</strong></td>
      <td style="text-align:center"><span class="grade-badge grade-${grade}">${grade}</span></td>
      <td style="text-align:center">${gp}</td>
      <td style="text-align:center">${qp}</td>
      <td style="text-align:center">${remarkFor(grade)}</td>
    </tr>`;
  }).join('');

  const failedCourses = courses.filter(c => (semData.courses[c.code] || {}).grade === 'F');

  const html = `
  <div class="result-slip" id="${containerId}">
    <div class="slip-watermark">FPO OKO</div>
    <div class="slip-header">
      <div class="crest">🎓</div>
      <h2>${meta.university}</h2>
      <p>${meta.address}</p>
      <div class="doctype">Official Result Slip — ${semLabel}</div>
    </div>
    <div class="slip-body">
      <div class="slip-info-grid">
        <div class="slip-info-row"><span>Student Name</span><span>${titleCase(s.name)}</span></div>
        <div class="slip-info-row"><span>Matric Number</span><span>${s.matric}</span></div>
        <div class="slip-info-row"><span>Department</span><span>${s.department}</span></div>
        <div class="slip-info-row"><span>Programme</span><span>${s.programme}</span></div>
        <div class="slip-info-row"><span>Level</span><span>${s.level}</span></div>
        <div class="slip-info-row"><span>Session</span><span>${meta.session}</span></div>
        <div class="slip-info-row"><span>Semester</span><span>${semLabel}</span></div>
        <div class="slip-info-row"><span>Verification Code</span><span style="font-family:monospace">${verifyCode}</span></div>
      </div>

      <div class="table-wrap" style="margin-bottom:18px">
        <table class="data-table">
          <thead><tr>
            <th>Course Code</th><th>Course Title</th><th>Units</th>
            <th>CA (30)</th><th>Exam (70)</th><th>Total (100)</th>
            <th>Grade</th><th>Grade Pt.</th><th>Quality Pt.</th><th>Remark</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px">
        ${slipStat('Total Units', semData.total_units)}
        ${slipStat('Units Passed', semData.units_passed)}
        ${slipStat('Quality Points', semData.qp)}
        ${slipStat('Semester GPA', fmt2(semData.gpa), true)}
        ${slipStat('Academic Standing', semData.remark || '—')}
      </div>

      ${failedCourses.length ? `
      <div class="alert alert-error" style="margin-bottom:16px">
        ⚠️ <strong>Carry-Over Courses (${failedCourses.length}):</strong> 
        ${failedCourses.map(c => `${c.code} — ${c.title}`).join('; ')}
      </div>` : `<div class="alert alert-success" style="margin-bottom:16px">✅ Passed all courses this semester.</div>`}

      <div class="slip-footer">
        <div class="signature-block">
          <div class="signature-line"></div>
          <p>Head of Department</p>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <p>Dean, Faculty of Engineering</p>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <p>Academic Registrar</p>
        </div>
        <div class="verify-block">
          <div class="qr-box">🔲<br>QR</div>
          <div class="verify-code">${verifyCode}</div>
          <p style="font-size:0.65rem;color:var(--slate-500);margin-top:4px">Verify at fpo.edu.ng/verify</p>
        </div>
      </div>
    </div>
  </div>`;

  const area = document.getElementById('semester-slip-area');
  // Insert or replace
  let existing = document.getElementById(containerId);
  if (existing) {
    existing.outerHTML = html;
  } else {
    area.insertAdjacentHTML('beforeend', html);
  }
}

function slipStat(label, value, highlight = false) {
  return `<div class="stat-box${highlight ? ' gold' : ''}">
    <div class="v" style="font-size:1.2rem">${value}</div>
    <div class="l">${label}</div>
  </div>`;
}

// ─── SESSION RESULT ───────────────────────────────────────────────────────────
function buildSessionResult(s) {
  const ann = s.annual;
  const meta = RESULT_DATA.meta;
  const degClass = getDegClass(ann.cgpa);
  const standing = getStanding(ann.cgpa);
  const verifyCode = `FPO-${s.matric.split('/').pop()}-ANN-2425`;

  // Merge all courses with scores
  const allCourses = [
    ...RESULT_DATA.courses_sem1.map(c => ({...c, sem: 'First', data: s.s1.courses[c.code] || {}})),
    ...RESULT_DATA.courses_sem2.map(c => ({...c, sem: 'Second', data: s.s2.courses[c.code] || {}})),
  ];

  const rows = allCourses.map(c => {
    const d = c.data;
    const grade = d.grade ?? '—';
    return `<tr>
      <td>${c.sem}</td>
      <td>${c.code}</td>
      <td>${c.title}</td>
      <td style="text-align:center">${c.unit}</td>
      <td style="text-align:center">${d.ca ?? '—'}</td>
      <td style="text-align:center">${d.exam ?? '—'}</td>
      <td style="text-align:center"><strong>${d.total ?? '—'}</strong></td>
      <td style="text-align:center"><span class="grade-badge grade-${grade}">${grade}</span></td>
      <td style="text-align:center">${d.gp ?? '—'}</td>
      <td style="text-align:center">${remarkFor(grade)}</td>
    </tr>`;
  }).join('');

  document.getElementById('session-slip-area').innerHTML = `
  <div class="result-slip">
    <div class="slip-watermark">FPO OKO</div>
    <div class="slip-header">
      <div class="crest">🎓</div>
      <h2>${meta.university}</h2>
      <p>${meta.address}</p>
      <div class="doctype">Sessional (Annual) Result — ${meta.session}</div>
    </div>
    <div class="slip-body">
      <div class="slip-info-grid">
        <div class="slip-info-row"><span>Student Name</span><span>${titleCase(s.name)}</span></div>
        <div class="slip-info-row"><span>Matric Number</span><span>${s.matric}</span></div>
        <div class="slip-info-row"><span>Department</span><span>${s.department}</span></div>
        <div class="slip-info-row"><span>Programme</span><span>${s.programme}</span></div>
        <div class="slip-info-row"><span>Level</span><span>${s.level}</span></div>
        <div class="slip-info-row"><span>Session</span><span>${meta.session}</span></div>
        <div class="slip-info-row"><span>1st Sem GPA</span><span>${fmt2(ann.sem1_gpa)}</span></div>
        <div class="slip-info-row"><span>2nd Sem GPA</span><span>${fmt2(ann.sem2_gpa)}</span></div>
        <div class="slip-info-row"><span>Annual CGPA</span><span><strong>${fmt2(ann.cgpa)}</strong></span></div>
        <div class="slip-info-row"><span>Classification</span><span>${degClass}</span></div>
        <div class="slip-info-row"><span>Academic Standing</span><span>${standing.label}</span></div>
        <div class="slip-info-row"><span>Verification</span><span style="font-family:monospace;font-size:0.78rem">${verifyCode}</span></div>
      </div>

      <div class="table-wrap" style="margin-bottom:18px">
        <table class="data-table">
          <thead><tr>
            <th>Semester</th><th>Course Code</th><th>Course Title</th><th>Units</th>
            <th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Grade Pt.</th><th>Remark</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px">
        ${slipStat('Total Units', ann.total_units)}
        ${slipStat('Quality Points', ann.total_qp)}
        ${slipStat('Annual GPA', fmt2(ann.annual_gpa))}
        ${slipStat('CGPA', fmt2(ann.cgpa), true)}
        ${slipStat('Degree Class', degClass)}
      </div>

      <div class="slip-footer">
        <div class="signature-block"><div class="signature-line"></div><p>Head of Department</p></div>
        <div class="signature-block"><div class="signature-line"></div><p>Dean of Faculty</p></div>
        <div class="signature-block"><div class="signature-line"></div><p>Academic Registrar</p></div>
        <div class="verify-block">
          <div class="qr-box">🔲<br>QR</div>
          <div class="verify-code">${verifyCode}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── ACADEMIC TRANSCRIPT ──────────────────────────────────────────────────────
function buildTranscript(s) {
  const meta = RESULT_DATA.meta;
  const ann = s.annual;
  const degClass = getDegClass(ann.cgpa);
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const makeSemRows = (courses, scores) => courses.map(c => {
    const d = scores[c.code] || {};
    const grade = d.grade ?? '—';
    const gp = d.gp ?? '—';
    const qp = (typeof gp === 'number') ? gp * c.unit : '—';
    return `<tr>
      <td>${c.code}</td><td>${c.title}</td>
      <td style="text-align:center">${c.unit}</td>
      <td style="text-align:center">${d.total ?? '—'}</td>
      <td style="text-align:center"><span class="grade-badge grade-${grade}">${grade}</span></td>
      <td style="text-align:center">${gp}</td>
      <td style="text-align:center">${qp}</td>
    </tr>`;
  }).join('');

  document.getElementById('transcript-area').innerHTML = `
  <div class="result-slip" id="transcript-doc">
    <div class="slip-watermark">OFFICIAL TRANSCRIPT</div>
    <div class="slip-header">
      <div class="crest">🎓</div>
      <h2>${meta.university}</h2>
      <p>${meta.address}</p>
      <div class="doctype">Official Academic Transcript</div>
    </div>
    <div class="slip-body">
      <div class="slip-info-grid" style="margin-bottom:24px">
        <div class="slip-info-row"><span>Student Name</span><span>${titleCase(s.name)}</span></div>
        <div class="slip-info-row"><span>Matric Number</span><span>${s.matric}</span></div>
        <div class="slip-info-row"><span>Programme</span><span>${s.programme}</span></div>
        <div class="slip-info-row"><span>Department</span><span>${s.department}</span></div>
        <div class="slip-info-row"><span>Faculty</span><span>${s.faculty}</span></div>
        <div class="slip-info-row"><span>Level</span><span>${s.level}</span></div>
        <div class="slip-info-row"><span>Session</span><span>${meta.session}</span></div>
        <div class="slip-info-row"><span>Date Issued</span><span>${date}</span></div>
      </div>

      <h3 style="font-family:var(--serif);font-size:1rem;color:var(--navy-900);margin-bottom:10px;border-bottom:2px solid var(--gold-500);padding-bottom:6px">First Semester — ${meta.session}</h3>
      <div class="table-wrap" style="margin-bottom:20px">
        <table class="data-table">
          <thead><tr><th>Code</th><th>Course Title</th><th>Units</th><th>Total</th><th>Grade</th><th>Grade Pt.</th><th>Quality Pt.</th></tr></thead>
          <tbody>${makeSemRows(RESULT_DATA.courses_sem1, s.s1.courses)}</tbody>
        </table>
      </div>
      <div style="text-align:right;margin-bottom:24px;font-weight:700;font-size:0.9rem;color:var(--navy-900)">
        Semester GPA: <span style="color:var(--gold-600);font-family:var(--serif);font-size:1.1rem">${fmt2(ann.sem1_gpa)}</span> &nbsp;|&nbsp; Units: ${ann.sem1_units}
      </div>

      <h3 style="font-family:var(--serif);font-size:1rem;color:var(--navy-900);margin-bottom:10px;border-bottom:2px solid var(--gold-500);padding-bottom:6px">Second Semester — ${meta.session}</h3>
      <div class="table-wrap" style="margin-bottom:20px">
        <table class="data-table">
          <thead><tr><th>Code</th><th>Course Title</th><th>Units</th><th>Total</th><th>Grade</th><th>Grade Pt.</th><th>Quality Pt.</th></tr></thead>
          <tbody>${makeSemRows(RESULT_DATA.courses_sem2, s.s2.courses)}</tbody>
        </table>
      </div>
      <div style="text-align:right;margin-bottom:28px;font-weight:700;font-size:0.9rem;color:var(--navy-900)">
        Semester GPA: <span style="color:var(--gold-600);font-family:var(--serif);font-size:1.1rem">${fmt2(ann.sem2_gpa)}</span> &nbsp;|&nbsp; Units: ${ann.sem2_units}
      </div>

      <div style="background:var(--navy-950);border-radius:var(--radius);padding:22px 28px;color:var(--white);display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:28px">
        ${[
          ['Total Credit Units', ann.total_units],
          ['Total Quality Points', ann.total_qp],
          ['Annual GPA', fmt2(ann.annual_gpa)],
          ['CGPA', fmt2(ann.cgpa)],
          ['Degree Classification', degClass],
          ['Graduation Eligibility', ann.cgpa >= 1.0 ? 'Eligible ✅' : 'Not Eligible ❌'],
        ].map(([l,v]) => `<div><div style="font-size:0.68rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:5px">${l}</div><div style="font-size:1.1rem;font-family:var(--serif);font-weight:700;color:var(--gold-400)">${v}</div></div>`).join('')}
      </div>

      <div class="slip-footer">
        <div class="signature-block"><div class="signature-line"></div><p>Academic Registrar</p></div>
        <div class="signature-block"><div class="signature-line"></div><p>Vice Chancellor / Rector</p></div>
        <div class="verify-block">
          <div class="qr-box">🔲<br>QR</div>
          <div class="verify-code">FPO-${s.matric.split('/').pop()}-TX-2425</div>
          <p style="font-size:0.65rem;color:var(--slate-500);margin-top:4px">Official Document — Not valid without institutional stamp</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── COURSE REGISTRATION ──────────────────────────────────────────────────────
function buildCourseReg(s) {
  const meta = RESULT_DATA.meta;

  const makeTable = (courses, semLabel) => `
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">${semLabel} — ${meta.session}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Course Code</th><th>Course Title</th><th>Units</th><th>Lecturer</th></tr></thead>
          <tbody>
            ${courses.map((c, i) => `<tr>
              <td>${i+1}</td>
              <td><strong>${c.code}</strong></td>
              <td>${c.title}</td>
              <td style="text-align:center">${c.unit}</td>
              <td>${c.lecturer || '—'}</td>
            </tr>`).join('')}
            <tr style="background:var(--navy-900);color:white;font-weight:700">
              <td colspan="3" style="text-align:right;color:white">Total Credit Units</td>
              <td style="text-align:center;color:var(--gold-400)">${courses.reduce((a,c) => a+c.unit, 0)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('courses-area').innerHTML = `
    <div class="alert alert-info" style="margin-bottom:20px">
      📋 <strong>${titleCase(s.name)}</strong> — ${s.programme} &nbsp;|&nbsp; ${s.level} &nbsp;|&nbsp; ${meta.session}<br>
      Total Registered: ${RESULT_DATA.courses_sem1.length + RESULT_DATA.courses_sem2.length} courses &nbsp;·&nbsp; 
      ${RESULT_DATA.courses_sem1.reduce((a,c)=>a+c.unit,0) + RESULT_DATA.courses_sem2.reduce((a,c)=>a+c.unit,0)} credit units
    </div>
    ${makeTable(RESULT_DATA.courses_sem1, 'First Semester')}
    ${makeTable(RESULT_DATA.courses_sem2, 'Second Semester')}`;
}

// ─── GPA CALCULATOR ───────────────────────────────────────────────────────────
function buildGpaCalc(s) {
  const ann = s.annual;
  const degClass = getDegClass(ann.cgpa);
  const standing = getStanding(ann.cgpa);

  // Failed courses
  const allCourses = [
    ...RESULT_DATA.courses_sem1.map(c => ({...c, data: s.s1.courses[c.code] || {}, sem: 'S1'})),
    ...RESULT_DATA.courses_sem2.map(c => ({...c, data: s.s2.courses[c.code] || {}, sem: 'S2'})),
  ];
  const failed = allCourses.filter(c => c.data.grade === 'F');
  const earned = allCourses.filter(c => c.data.grade && c.data.grade !== 'F').reduce((a,c) => a + c.unit, 0);

  document.getElementById('gpa-calc-area').innerHTML = `
    <div class="stat-grid" style="margin-bottom:24px">
      ${[
        ['1st Sem GPA', fmt2(ann.sem1_gpa)],
        ['2nd Sem GPA', fmt2(ann.sem2_gpa)],
        ['Annual GPA',  fmt2(ann.annual_gpa)],
        ['Total Units', ann.total_units],
        ['Units Earned', earned],
        ['Units Failed', ann.total_units - earned],
      ].map(([l,v]) => `<div class="stat-box"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
    </div>

    <div class="gpa-result-box">
      <div class="big-num">${fmt2(ann.cgpa)}</div>
      <div class="label">Cumulative GPA (CGPA)</div>
      <div style="margin-top:18px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap">
        <span class="standing-badge" style="background:rgba(255,255,255,0.12);color:var(--gold-400)">🏆 ${degClass}</span>
        <span class="standing-badge ${standing.cls}">${standing.icon} ${standing.label}</span>
      </div>
    </div>

    ${failed.length ? `
    <div class="card" style="margin-top:20px">
      <div class="card-title">Outstanding / Carry-Over Courses (${failed.length})</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Semester</th><th>Code</th><th>Course Title</th><th>Units</th><th>Score</th></tr></thead>
          <tbody>
            ${failed.map(c => `<tr>
              <td>${c.sem === 'S1' ? 'First' : 'Second'}</td>
              <td>${c.code}</td><td>${c.title}</td>
              <td style="text-align:center">${c.unit}</td>
              <td style="text-align:center"><span class="grade-badge grade-F">${c.data.total ?? '—'}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : `<div class="alert alert-success" style="margin-top:20px">✅ No outstanding carry-over courses. Eligible for progression.</div>`}`;
}

// ─── ACADEMIC PROGRESS ────────────────────────────────────────────────────────
function buildProgress(s) {
  const ann = s.annual;
  const degClass = getDegClass(ann.cgpa);
  const eligible = ann.cgpa >= 1.0;

  document.getElementById('progress-summary-card').innerHTML = `
    <div class="card-title">Graduation & Progression Summary</div>
    <div class="info-grid">
      <div class="info-item"><div class="lbl">First Semester GPA</div><div class="val">${fmt2(ann.sem1_gpa)}</div></div>
      <div class="info-item"><div class="lbl">Second Semester GPA</div><div class="val">${fmt2(ann.sem2_gpa)}</div></div>
      <div class="info-item"><div class="lbl">CGPA</div><div class="val" style="color:var(--gold-600);font-size:1.2rem">${fmt2(ann.cgpa)}</div></div>
      <div class="info-item"><div class="lbl">Degree Classification</div><div class="val">${degClass}</div></div>
      <div class="info-item"><div class="lbl">Graduation Eligibility</div>
        <div class="val">${eligible
          ? '<span class="standing-badge standing-good">✅ Eligible</span>'
          : '<span class="standing-badge standing-withdrawal">❌ Not Eligible</span>'}</div>
      </div>
      <div class="info-item"><div class="lbl">Position in Class</div><div class="val">${ordinal(s.position)} out of ${RESULT_DATA.students.length}</div></div>
    </div>`;
}

function buildProgressChart(s) {
  if (!s) return;
  const ctx = document.getElementById('progressChart').getContext('2d');
  if (progressChart) progressChart.destroy();

  progressChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['First Semester GPA', 'Second Semester GPA', 'Annual CGPA'],
      datasets: [{
        label: 'GPA / CGPA',
        data: [s.annual.sem1_gpa, s.annual.sem2_gpa, s.annual.cgpa],
        backgroundColor: ['rgba(40,75,120,0.85)', 'rgba(40,75,120,0.6)', 'rgba(212,160,23,0.85)'],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { min: 0, max: 5, grid: { color: 'rgba(0,0,0,0.06)' },
             ticks: { callback: v => v.toFixed(2) }},
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(2)} / 5.00` }}
      }
    }
  });
}

// ─── COHORT CHARTS (course statistics page) ───────────────────────────────────
function buildCohortCharts() {
  // Grade distribution across all students, all courses
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  RESULT_DATA.students.forEach(s => {
    [...Object.values(s.s1.courses), ...Object.values(s.s2.courses)].forEach(c => {
      if (c.grade && gradeCounts[c.grade] !== undefined) gradeCounts[c.grade]++;
    });
  });

  const gc = document.getElementById('gradeChart').getContext('2d');
  if (gradeChart) gradeChart.destroy();
  gradeChart = new Chart(gc, {
    type: 'bar',
    data: {
      labels: Object.keys(gradeCounts),
      datasets: [{
        label: 'Count',
        data: Object.values(gradeCounts),
        backgroundColor: ['#1a7a4c','#2563a8','#b7791f','#9a5a12','#b1450f','#c0392b'],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { grid: { color: 'rgba(0,0,0,0.06)' } }, x: { grid: { display: false } } }
    }
  });

  // CGPA distribution buckets
  const cgpaBuckets = { '0–0.99': 0, '1–1.99': 0, '2–2.99': 0, '3–3.99': 0, '4–5': 0 };
  RESULT_DATA.students.forEach(s => {
    const c = s.annual.cgpa || 0;
    if (c < 1) cgpaBuckets['0–0.99']++;
    else if (c < 2) cgpaBuckets['1–1.99']++;
    else if (c < 3) cgpaBuckets['2–2.99']++;
    else if (c < 4) cgpaBuckets['3–3.99']++;
    else cgpaBuckets['4–5']++;
  });

  const cc = document.getElementById('cgpaChart').getContext('2d');
  if (cgpaChart) cgpaChart.destroy();
  cgpaChart = new Chart(cc, {
    type: 'doughnut',
    data: {
      labels: Object.keys(cgpaBuckets),
      datasets: [{
        data: Object.values(cgpaBuckets),
        backgroundColor: ['#c0392b','#b7791f','#2563a8','#1a7a4c','#0f1f38'],
        borderWidth: 2, borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { font: { size: 12 }, boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} students` }}
      }
    }
  });
}

function buildCohortStats() {
  const students = RESULT_DATA.students;
  const cgpas = students.map(s => s.annual.cgpa || 0).filter(x => x > 0);
  const highest = Math.max(...cgpas).toFixed(2);
  const lowest = Math.min(...cgpas).toFixed(2);
  const avg = (cgpas.reduce((a,b) => a+b, 0) / cgpas.length).toFixed(2);
  const firstClass = students.filter(s => s.annual.cgpa >= 4.5).length;
  const secUpper = students.filter(s => s.annual.cgpa >= 3.5 && s.annual.cgpa < 4.5).length;
  const secLower = students.filter(s => s.annual.cgpa >= 2.4 && s.annual.cgpa < 3.5).length;
  const eligible = students.filter(s => s.annual.cgpa >= 1.0).length;

  document.getElementById('cohort-stat-grid').innerHTML = [
    ['Total Students', students.length],
    ['Highest CGPA', highest],
    ['Lowest CGPA', lowest],
    ['Average CGPA', avg],
    ['First Class', firstClass],
    ['Second Class Upper', secUpper],
    ['Second Class Lower', secLower],
    ['Eligible to Graduate', eligible],
  ].map(([l,v]) => `<div class="stat-box"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
}

// ─── ADMIN TABLES ─────────────────────────────────────────────────────────────
function buildAdminTables() {
  const grading = [
    ['70–100','A',5,'Excellent'],['60–69','B',4,'Very Good'],
    ['50–59','C',3,'Good'],['45–49','D',2,'Fair'],
    ['40–44','E',1,'Pass'],['0–39','F',0,'Fail'],
  ];
  document.getElementById('grading-table').innerHTML = `
    <thead><tr><th>Score Range</th><th>Grade</th><th>Grade Point</th><th>Remark</th></tr></thead>
    <tbody>${grading.map(([r,g,gp,rk]) => `<tr><td>${r}</td><td><span class="grade-badge grade-${g}">${g}</span></td><td>${gp}</td><td>${rk}</td></tr>`).join('')}</tbody>`;

  const cls = [
    ['4.50–5.00','First Class'],['3.50–4.49','Second Class Upper'],
    ['2.40–3.49','Second Class Lower'],['1.50–2.39','Third Class'],
    ['1.00–1.49','Pass'],['0.00–0.99','Fail / Withdrawn'],
  ];
  document.getElementById('classification-table').innerHTML = `
    <thead><tr><th>CGPA Range</th><th>Classification</th></tr></thead>
    <tbody>${cls.map(([r,c]) => `<tr><td>${r}</td><td><strong>${c}</strong></td></tr>`).join('')}</tbody>`;

  document.getElementById('dept-info-grid').innerHTML = [
    ['University', RESULT_DATA.meta.university],
    ['Faculty',    RESULT_DATA.meta.faculty],
    ['Department', RESULT_DATA.meta.department],
    ['Programme',  RESULT_DATA.meta.programme],
    ['Level',      RESULT_DATA.meta.level],
    ['Session',    RESULT_DATA.meta.session],
  ].map(([l,v]) => `<div class="info-item"><div class="lbl">${l}</div><div class="val">${v}</div></div>`).join('');
}

// ─── PDF DOWNLOAD ─────────────────────────────────────────────────────────────
async function downloadPDF(elementId, filename) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const { jsPDF } = window.jspdf;

  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳ Generating…';
  btn.disabled = true;

  try {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let imgH = pageW / ratio;

    if (imgH > pageH) {
      // Multi-page support
      let y = 0;
      while (y < canvas.height) {
        const sliceH = Math.min(canvas.height - y, (pageH / pageW) * canvas.width);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, -y);
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, (sliceH / canvas.width) * pageW);
        y += sliceH;
        if (y < canvas.height) pdf.addPage();
      }
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
    }

    pdf.save(`${filename}_${currentStudent?.matric?.replace(/\//g, '-') || 'result'}.pdf`);
  } catch (err) {
    alert('PDF generation failed. Please try printing instead (Ctrl+P).');
    console.error(err);
  }

  btn.innerHTML = orig;
  btn.disabled = false;
}

// ─── DARK MODE ────────────────────────────────────────────────────────────────
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  const isDark = localStorage.getItem('fpo_dark') === '1';
  if (isDark) { document.body.classList.add('dark'); btn.textContent = '☀️'; }

  btn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    btn.textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('fpo_dark', dark ? '1' : '0');
  });
}

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────
function getDegClass(cgpa) {
  for (const r of DEGREE_CLASS) if (cgpa >= r.min && cgpa <= r.max) return r.label;
  return 'Unclassified';
}

function getStanding(gpa) {
  const icons = ['🟢','🔵','🟡','🔴'];
  for (let i = 0; i < STANDING_RULES.length; i++) {
    const r = STANDING_RULES[i];
    if (gpa >= r.min) return { ...r, icon: icons[i] };
  }
  return { label: 'Withdrawal Risk', cls: 'standing-withdrawal', icon: '🔴' };
}

function remarkFor(grade) {
  const map = { A:'Excellent', B:'Very Good', C:'Good', D:'Fair', E:'Pass', F:'Fail' };
  return map[grade] || '—';
}

function fmt2(v) { return typeof v === 'number' ? v.toFixed(2) : '—'; }

function ordinal(n) {
  if (!n || isNaN(n)) return n || '—';
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function titleCase(str) {
  return str ? str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
