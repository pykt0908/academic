// App State
let authToken = localStorage.getItem('teacher_token') || null;
let currentTeacher = null;
let teacherSubjectsData = [];
let currentMatrixData = null;

// DOM References
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');

const navTeacherName = document.getElementById('navTeacherName');
const navTeacherDept = document.getElementById('navTeacherDept');

const selTermYear = document.getElementById('selTermYear');
const selSubject = document.getElementById('selSubject');
const selClass = document.getElementById('selClass');
const loadingStatus = document.getElementById('loadingStatus');

const statsSection = document.getElementById('statsSection');
const statStudents = document.getElementById('statStudents');
const statSessions = document.getElementById('statSessions');

const sheetTitle = document.getElementById('sheetTitle');
const sheetSubtitle = document.getElementById('sheetSubtitle');
const legendPills = document.getElementById('legendPills');
const matrixThead = document.getElementById('matrixThead');
const matrixTbody = document.getElementById('matrixTbody');

const btnPrint = document.getElementById('btnPrint');
const btnExportExcel = document.getElementById('btnExportExcel');

const printContainer = document.getElementById('printContainer');
const printCourseInfo = document.getElementById('printCourseInfo');
const printTeacherInfo = document.getElementById('printTeacherInfo');
const printTermInfo = document.getElementById('printTermInfo');
const printSignTeacher = document.getElementById('printSignTeacher');
const printMatrixTable = document.getElementById('printMatrixTable');

// Lifecycle initialization
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        verifySession();
    } else {
        showLogin();
    }
});

function showLogin() {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
}

function showDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
}

// 1. Session Verification
async function verifySession() {
    try {
        const res = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error('Session invalid');
        const teacher = await res.json();
        currentTeacher = teacher;
        setupTeacherHeader(teacher);
        showDashboard();
        await loadTerms();
    } catch (e) {
        logout();
    }
}

function setupTeacherHeader(teacher) {
    navTeacherName.textContent = teacher.TeacherName || teacher.TeacherNo;
    navTeacherDept.textContent = teacher.DepartNameFull ? `แผนก: ${teacher.DepartNameFull}` : `รหัส: ${teacher.TeacherNo}`;
    printSignTeacher.textContent = teacher.TeacherName || teacher.TeacherNo;
    printTeacherInfo.textContent = `อาจารย์ผู้สอน: ${teacher.TeacherName || teacher.TeacherNo}`;
}

// 2. Login Event
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    btnLogin.disabled = true;
    btnLogin.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังเข้าสู่ระบบ...`;

    try {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');

        authToken = data.token;
        localStorage.setItem('teacher_token', authToken);
        currentTeacher = data;

        setupTeacherHeader(data);
        showDashboard();
        await loadTerms();

    } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.remove('hidden');
    } finally {
        btnLogin.disabled = false;
        btnLogin.innerHTML = `<span>เข้าสู่ระบบ</span><i class="fa-solid fa-arrow-right text-sm"></i>`;
    }
});

// 3. Logout Event
btnLogout.addEventListener('click', () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
        logout();
    }
});

function logout() {
    if (authToken) {
        fetch('/api/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        }).catch(() => {});
    }
    authToken = null;
    currentTeacher = null;
    localStorage.removeItem('teacher_token');
    showLogin();
}

// 4. Load Terms & Years
async function loadTerms() {
    try {
        const res = await fetch('/api/terms', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const terms = await res.json();
        selTermYear.innerHTML = '';
        terms.forEach((t, i) => {
            const opt = document.createElement('option');
            opt.value = `${t.Term}/${t.Year}`;
            opt.textContent = `ภาคเรียนที่ ${t.Term}/${t.Year}`;
            if (i === 0) opt.selected = true;
            selTermYear.appendChild(opt);
        });

        selTermYear.addEventListener('change', loadTeacherSubjects);
        await loadTeacherSubjects();
    } catch (err) {
        console.error('Error loading terms:', err);
    }
}

// 5. Load Subjects & Classrooms for this teacher
async function loadTeacherSubjects() {
    const [term, year] = selTermYear.value.split('/');
    if (!term || !year) return;

    try {
        const res = await fetch(`/api/teacher/subjects-classes?term=${term}&year=${year}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        teacherSubjectsData = await res.json();

        // Populate Subjects Dropdown
        selSubject.innerHTML = `<option value="">-- โปรดเลือกรายวิชา (${teacherSubjectsData.length} วิชา) --</option>`;
        teacherSubjectsData.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.subNo;
            opt.textContent = `${s.subNo} - ${s.subjectName} (${s.classes.length} ห้อง)`;
            selSubject.appendChild(opt);
        });

        // Reset Classroom dropdown
        selClass.innerHTML = `<option value="">-- โปรดเลือกรายวิชาก่อน --</option>`;
        resetTableMessage('กรุณาเลือกรายวิชา และห้องเรียน');

    } catch (err) {
        console.error('Error loading subjects:', err);
    }
}

// Step 2 Changed: Subject chosen -> Populate classrooms
selSubject.addEventListener('change', () => {
    const selectedSubNo = selSubject.value;
    if (!selectedSubNo) {
        selClass.innerHTML = `<option value="">-- โปรดเลือกรายวิชาก่อน --</option>`;
        resetTableMessage('กรุณาเลือกรายวิชา และห้องเรียน');
        return;
    }

    const subObj = teacherSubjectsData.find(s => s.subNo === selectedSubNo);
    if (!subObj || !subObj.classes.length) {
        selClass.innerHTML = `<option value="">-- ไม่พบห้องเรียนในวิชานี้ --</option>`;
        resetTableMessage('ไม่พบห้องเรียนในวิชานี้');
        return;
    }

    selClass.innerHTML = `<option value="">-- โปรดเลือกห้องเรียน (${subObj.classes.length} ห้อง) --</option>`;
    subObj.classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.classNo;
        opt.textContent = c.className;
        selClass.appendChild(opt);
    });

    resetTableMessage('โปรดเลือกห้องเรียนเพื่อเปิดสมุดเช็คชื่อทันที');
});

// Step 3 Changed: Classroom chosen -> IMMEDIATELY FETCH AND DISPLAY MATRIX!
selClass.addEventListener('change', () => {
    const selectedClassNo = selClass.value;
    if (!selectedClassNo) {
        resetTableMessage('โปรดเลือกห้องเรียนเพื่อเปิดสมุดเช็คชื่อทันที');
        return;
    }
    fetchAttendanceMatrix();
});

function resetTableMessage(msg) {
    statsSection.classList.add('hidden');
    legendPills.classList.add('hidden');
    sheetTitle.textContent = 'ตารางบันทึกเวลาเรียนและการเช็คชื่อ';
    sheetSubtitle.textContent = msg;
    matrixThead.innerHTML = '';
    matrixTbody.innerHTML = `
        <tr>
            <td colspan="10" class="py-16 text-center text-slate-400 text-base">
                <i class="fa-solid fa-arrow-up text-2xl mb-2 text-navy-600 block animate-bounce"></i>
                ${msg}
            </td>
        </tr>
    `;
}

// 6. Fetch Attendance Matrix
async function fetchAttendanceMatrix() {
    const [term, year] = selTermYear.value.split('/');
    const subNo = selSubject.value;
    const classNo = selClass.value;

    if (!term || !year || !subNo || !classNo) return;

    loadingStatus.classList.remove('hidden');
    matrixTbody.innerHTML = `
        <tr>
            <td colspan="10" class="py-16 text-center text-slate-500 text-base">
                <i class="fa-solid fa-spinner fa-spin text-3xl mb-2 text-navy-700 block"></i>
                กำลังดึงข้อมูลสมุดบันทึกเวลาเรียน (Read-Only)...
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`/api/teacher/attendance-sheet?term=${term}&year=${year}&subNo=${encodeURIComponent(subNo)}&classNo=${encodeURIComponent(classNo)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล');

        currentMatrixData = data;
        renderMatrixTable(data);

    } catch (err) {
        matrixTbody.innerHTML = `
            <tr>
                <td colspan="10" class="py-16 text-center text-rose-500 text-base">
                    <i class="fa-solid fa-triangle-exclamation text-3xl mb-2 block"></i>
                    ${err.message}
                </td>
            </tr>
        `;
    } finally {
        loadingStatus.classList.add('hidden');
    }
}

// 7. Render Attendance Matrix Table (Minimal Blue Aesthetic)
function renderMatrixTable(data) {
    const { info, monthGroups, columns, students } = data;

    // Update Headers & Titles
    sheetTitle.textContent = `${info.subNo} ${info.subjectName} — ${info.className}`;
    sheetSubtitle.textContent = `ภาคเรียนที่ ${info.term}/${info.year} &bull; นักเรียน ${info.totalStudents} คน &bull; บันทึกแล้วทั้งหมด ${info.totalSessions} คาบ`;

    statStudents.textContent = info.totalStudents;
    statSessions.textContent = info.totalSessions;
    statsSection.classList.remove('hidden');
    legendPills.classList.remove('hidden');

    if (students.length === 0) {
        matrixThead.innerHTML = '';
        matrixTbody.innerHTML = `
            <tr>
                <td colspan="10" class="py-16 text-center text-slate-400 text-base">
                    <i class="fa-solid fa-user-slash text-3xl mb-2 text-slate-300 block"></i>
                    ไม่พบรายชื่อนักเรียนในห้องเรียนนี้
                </td>
            </tr>
        `;
        return;
    }

    // ============================================
    // BUILD MULTI-LEVEL THEAD (Minimal Blue Tone)
    // ============================================
    let theadHtml = '';

    // Row 1: Month Headers
    theadHtml += `<tr class="bg-navy-900 text-white text-sm">`;
    theadHtml += `<th rowspan="4" class="sticky-col-1 py-3 px-2 w-14 text-center bg-navy-950 border-r border-navy-800">เลขที่</th>`;
    theadHtml += `<th rowspan="4" class="sticky-col-2 py-3 px-3 w-36 text-center bg-navy-950 border-r border-navy-800">เลขประจำตัว</th>`;
    theadHtml += `<th rowspan="4" class="sticky-col-3 py-3 px-4 w-56 text-left bg-navy-950 border-r-2 border-navy-700 shadow-sm">ชื่อ - สกุล</th>`;

    if (monthGroups.length > 0) {
        monthGroups.forEach(m => {
            theadHtml += `<th colspan="${m.colspan}" class="py-2 px-2 border-r border-navy-800 text-center font-semibold tracking-wide">${m.monthName} ${m.yearThai}</th>`;
        });
    } else {
        theadHtml += `<th class="py-2 px-4 text-center">ไม่มีรายการบันทึกการสอน</th>`;
    }

    theadHtml += `<th colspan="4" class="py-2 px-3 bg-navy-950 text-center font-semibold border-l-2 border-navy-800">สรุปเวลาเรียน</th>`;
    theadHtml += `</tr>`;

    // Row 2: Week Headers
    theadHtml += `<tr class="bg-navy-800 text-blue-100 text-xs">`;
    monthGroups.forEach(m => {
        m.weekGroups.forEach(w => {
            theadHtml += `<th colspan="${w.colspan}" class="py-1.5 px-1 border-r border-navy-700 text-center font-medium">สัปดาห์ ${w.weekNo}</th>`;
        });
    });
    theadHtml += `<th colspan="4" class="bg-navy-900 border-l-2 border-navy-800"></th>`;
    theadHtml += `</tr>`;

    // Row 3: Date Headers
    theadHtml += `<tr class="bg-navy-700 text-white text-xs font-medium">`;
    columns.forEach(c => {
        theadHtml += `<th class="py-1 px-1.5 w-11 text-center border-r border-navy-600" title="วันที่ ${c.dateStr}">${c.dateNum}</th>`;
    });
    theadHtml += `<th colspan="4" class="bg-navy-800 border-l-2 border-navy-800"></th>`;
    theadHtml += `</tr>`;

    // Row 4: Period Headers
    theadHtml += `<tr class="bg-slate-100 text-slate-700 text-[11px] font-bold border-b border-slate-300">`;
    columns.forEach(c => {
        theadHtml += `<th class="py-1.5 px-1 w-11 text-center border-r border-slate-300" title="${c.timeName}">${c.timeNo}</th>`;
    });
    theadHtml += `<th class="py-1.5 px-2 w-12 text-center text-emerald-800 bg-emerald-50 border-l border-slate-300">มา</th>`;
    theadHtml += `<th class="py-1.5 px-2 w-12 text-center text-rose-800 bg-rose-50 border-l border-slate-200">ขาด</th>`;
    theadHtml += `<th class="py-1.5 px-2 w-12 text-center text-amber-800 bg-amber-50 border-l border-slate-200">ลา</th>`;
    theadHtml += `<th class="py-1.5 px-2.5 w-16 text-center text-navy-900 bg-blue-50 border-l border-slate-200">%</th>`;
    theadHtml += `</tr>`;

    matrixThead.innerHTML = theadHtml;

    // ============================================
    // BUILD TBODY (Student Rows - Minimalist Clean)
    // ============================================
    let tbodyHtml = '';
    students.forEach((std, i) => {
        const isEven = i % 2 === 0;
        const rowBg = isEven ? 'bg-white' : 'bg-slate-50/70';

        tbodyHtml += `<tr class="${rowBg} hover:bg-blue-50/60 transition border-b border-slate-100 text-sm">`;
        tbodyHtml += `<td class="sticky-col-1 ${rowBg} py-2 px-2 text-center font-semibold text-slate-500 border-r border-slate-200">${std.no}</td>`;
        tbodyHtml += `<td class="sticky-col-2 ${rowBg} py-2 px-3 text-center font-mono text-xs font-semibold text-slate-600 border-r border-slate-200">${std.stdNo}</td>`;
        tbodyHtml += `<td class="sticky-col-3 ${rowBg} py-2 px-4 text-left font-medium text-slate-900 border-r-2 border-slate-200 truncate">${std.stdName}</td>`;

        // Check Cells
        std.checks.forEach(chk => {
            let cellContent = '-';
            let cellStyle = 'text-slate-300 font-light';
            const char = chk.code;

            if (char === '/' || char === 'ม') {
                cellContent = '/';
                cellStyle = 'text-emerald-600 font-bold text-base';
            } else if (char === 'ข') {
                cellContent = 'ข';
                cellStyle = 'text-rose-600 font-bold bg-rose-50/80';
            } else if (char === 'ล') {
                cellContent = 'ล';
                cellStyle = 'text-amber-600 font-bold bg-amber-50/80';
            } else if (char === 'ป') {
                cellContent = 'ป';
                cellStyle = 'text-yellow-600 font-bold bg-yellow-50/80';
            }

            tbodyHtml += `<td class="py-1.5 px-1 text-center border-r border-slate-100 ${cellStyle}">${cellContent}</td>`;
        });

        // Summary Cells
        tbodyHtml += `<td class="py-2 px-2 text-center font-semibold text-emerald-700 bg-emerald-50/40 border-l border-slate-200">${std.summary.present}</td>`;
        tbodyHtml += `<td class="py-2 px-2 text-center font-semibold text-rose-700 bg-rose-50/40 border-l border-slate-100">${std.summary.absent}</td>`;
        tbodyHtml += `<td class="py-2 px-2 text-center font-semibold text-amber-700 bg-amber-50/40 border-l border-slate-100">${std.summary.leave + std.summary.sick}</td>`;
        tbodyHtml += `<td class="py-2 px-2.5 text-center font-bold text-navy-900 bg-blue-50/40 border-l border-slate-100">${std.summary.percent}%</td>`;

        tbodyHtml += `</tr>`;
    });

    matrixTbody.innerHTML = tbodyHtml;
}

// 8. Print Official A4 Landscape (Sarabun Font)
btnPrint.addEventListener('click', () => {
    if (!currentMatrixData) {
        alert('กรุณาเลือกวิชาและห้องเรียนเพื่อเปิดตารางก่อนพิมพ์');
        return;
    }

    const { info } = currentMatrixData;
    printCourseInfo.textContent = `วิชา: ${info.subNo} ${info.subjectName} | ระดับชั้น/ห้อง: ${info.className}`;
    printTermInfo.textContent = `ภาคเรียนที่: ${info.term}/${info.year}`;
    printTeacherInfo.textContent = `อาจารย์ผู้สอน: ${currentTeacher.TeacherName || currentTeacher.TeacherNo}`;

    // Clone table HTML
    printMatrixTable.innerHTML = `
        <thead>${matrixThead.innerHTML}</thead>
        <tbody>${matrixTbody.innerHTML}</tbody>
    `;

    window.print();
});

// 9. Export Excel
btnExportExcel.addEventListener('click', () => {
    if (!currentMatrixData) {
        alert('กรุณาเลือกวิชาและห้องเรียนก่อนดาวน์โหลด Excel');
        return;
    }

    const [term, year] = selTermYear.value.split('/');
    const subNo = selSubject.value;
    const classNo = selClass.value;

    const queryParams = new URLSearchParams({
        term,
        year,
        subNo,
        classNo
    });

    fetch(`/api/teacher/attendance-sheet/export-excel?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการดาวน์โหลด Excel');
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ตารางเช็คชื่อ_${classNo}_${subNo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
});
