const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const ExcelJS = require('exceljs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve Static Assets (React client/dist if built, otherwise public)
const fs = require('fs');
const clientDist = path.join(__dirname, 'client', 'dist');
const staticDir = fs.existsSync(clientDist) ? clientDist : path.join(__dirname, 'public');

app.use(express.static(staticDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Database connection configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '24252'),
    database: process.env.DB_NAME || 'Vichakarn',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;
function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(dbConfig)
            .connect()
            .then(pool => {
                console.log('Connected to SQL Server successfully (Read-Only Mode)');
                return pool;
            })
            .catch(err => {
                console.error('SQL Server Connection Error:', err);
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

// STRICT READ-ONLY GUARD:
// Enforce that queries NEVER execute any modifying commands
function executeSafeQuery(pool, queryText, params = {}) {
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC|EXECUTE|MERGE)\b/i;
    if (forbidden.test(queryText)) {
        throw new Error('SECURITY VIOLATION: Database write operations are strictly forbidden!');
    }
    const safeText = 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\n' + queryText;
    const request = pool.request();
    for (const [key, val] of Object.entries(params)) {
        request.input(key, val);
    }
    return request.query(safeText);
}

// Simple session store
const sessions = new Map();

function requireTeacherAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
    }
    const token = authHeader.split(' ')[1];
    const session = sessions.get(token);
    if (!session) {
        return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    req.teacher = session;
    next();
}

// 1. Teacher Login (Read-Only Authentication)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน' });
        }

        const pool = await getPool();
        const query = `
            SELECT U.UserName, U.TeacherNo,
                   IsNull(P.PrefixName,'') + T.Fname + ' ' + T.Lname AS TeacherName,
                   T.TeachDepart, D.DepartNameFull
            FROM Personal.dbo.tblUserName U
            JOIN Personal.dbo.tblTeacherHis T ON U.TeacherNo = T.TeacherNo
            LEFT JOIN Basedata.dbo.tblPrefix P ON T.PrefixNo = P.PrefixNo
            LEFT JOIN Basedata.dbo.tblDepart D ON T.TeachDepart = D.DepartNo
            WHERE (U.UserName = @username OR U.TeacherNo = @username)
              AND U.Password = @password
              AND U.IsNormal = '1'
        `;

        const result = await executeSafeQuery(pool, query, { username, password });
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์ครูผู้สอน' });
        }

        const teacher = result.recordset[0];
        const token = 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        sessions.set(token, teacher);

        res.json({
            token,
            teacherNo: teacher.TeacherNo,
            teacherName: teacher.TeacherName,
            department: teacher.DepartNameFull || ''
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ' + err.message });
    }
});

// 2. Current teacher profile
app.get('/api/me', requireTeacherAuth, (req, res) => {
    res.json(req.teacher);
});

// 3. Logout
app.post('/api/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        sessions.delete(token);
    }
    res.json({ message: 'ออกจากระบบเรียบร้อย' });
});

// 4. Get Terms & Years
app.get('/api/terms', requireTeacherAuth, async (req, res) => {
    try {
        const pool = await getPool();
        const query = `
            SELECT Y.[Year], T.Term
            FROM (
                SELECT DISTINCT [Year] FROM Vichakarn.dbo.tblTimeTable WHERE [Year] IS NOT NULL
                UNION
                SELECT DISTINCT sYear AS [Year] FROM Vichakarn.dbo.tblTeach WHERE sYear IS NOT NULL
            ) Y
            CROSS JOIN (
                SELECT '1' AS Term UNION SELECT '2' UNION SELECT '3'
            ) T
            ORDER BY Y.[Year] DESC, T.Term ASC
        `;
        const result = await executeSafeQuery(pool, query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Terms error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Get Subjects and their Classrooms taught by THIS teacher only
app.get('/api/teacher/subjects-classes', requireTeacherAuth, async (req, res) => {
    try {
        const { term, year } = req.query;
        if (!term || !year) {
            return res.status(400).json({ error: 'กรุณาระบุภาคเรียนและปีการศึกษา' });
        }

        const pool = await getPool();
        const query = `
            SELECT DISTINCT T.SubNo, S.Subject, T.ClassNo,
                   COALESCE(
                       NULLIF(LTRIM(RTRIM(IsNull(tl.LavelName, '') + ' ' + SUBSTRING(T.ClassNo, 5, 1) + '/' + SUBSTRING(T.ClassNo, 6, CASE WHEN LEN(T.ClassNo) > 5 THEN LEN(T.ClassNo) - 5 ELSE 1 END) + ' ' + IsNull(td.DepartNamefull, ''))), ''),
                       T.ClassNo
                   ) AS ClassName
            FROM (
                SELECT TT.TeacherNo, TT.SubNo, TT.ClassNo, TT.Term, TT.[Year]
                FROM Vichakarn.dbo.tblTimeTable TT
                UNION
                SELECT TC.TeacherNo, TC.SubNo, 
                       (TC.LavelNo + TC.DepartNo + TC.RoundNo + TC.[Year] + TC.Room) AS ClassNo,
                       TC.sTerm AS Term, TC.sYear AS [Year]
                FROM Vichakarn.dbo.tblTeach TC
                WHERE TC.sTerm IS NOT NULL AND TC.sYear IS NOT NULL
            ) T
            INNER JOIN Vichakarn.dbo.tblSubject S ON T.SubNo = S.SubNo
            LEFT JOIN Basedata.dbo.tblLavel tl ON tl.LavelNo = SUBSTRING(T.ClassNo, 1, 1)
            LEFT JOIN Basedata.dbo.tblDepart td ON td.DepartNo = SUBSTRING(T.ClassNo, 2, 2)
            WHERE T.TeacherNo = @teacherNo
              AND T.Term = @term
              AND T.[Year] = @year
            ORDER BY S.Subject, ClassName
        `;

        const result = await executeSafeQuery(pool, query, {
            teacherNo: req.teacher.TeacherNo,
            term: String(term),
            year: String(year)
        });

        // Group by SubNo
        const subjectMap = new Map();
        for (const row of result.recordset) {
            if (!subjectMap.has(row.SubNo)) {
                subjectMap.set(row.SubNo, {
                    subNo: row.SubNo,
                    subjectName: row.Subject,
                    classes: []
                });
            }
            subjectMap.get(row.SubNo).classes.push({
                classNo: row.ClassNo,
                className: row.ClassName
            });
        }

        res.json(Array.from(subjectMap.values()));
    } catch (err) {
        console.error('Subjects-Classes error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Thai Month Names
const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

// Helper to build hierarchy groups (Month -> Week -> Date)
function buildMonthGroups(columns) {
    const monthGroups = [];
    for (const col of columns) {
        let mg = monthGroups.find(m => m.monthKey === col.monthKey);
        if (!mg) {
            mg = {
                monthKey: col.monthKey,
                monthName: col.monthName,
                yearThai: col.yearThai,
                colspan: 0,
                weekGroups: []
            };
            monthGroups.push(mg);
        }
        mg.colspan++;

        let wg = mg.weekGroups.find(w => w.weekNo === col.weekNo);
        if (!wg) {
            wg = {
                weekNo: col.weekNo,
                colspan: 0,
                dateGroups: []
            };
            mg.weekGroups.push(wg);
        }
        wg.colspan++;

        let dg = wg.dateGroups.find(d => d.dateStr === col.dateStr);
        if (!dg) {
            dg = {
                dateStr: col.dateStr,
                dateNum: col.dateNum,
                dayShortName: col.dayShortName,
                colspan: 0
            };
            wg.dateGroups.push(dg);
        }
        dg.colspan++;
    }
    return monthGroups;
}

// Core Attendance Matrix Builder matching MisSchool Academic (Menu 5.22.1 / frmCheckTimeLearn)
async function getAttendanceSheetData(pool, teacherNo, term, year, subNo, classNo, customDateBegin) {
    const termYear = `${term}/${year}`;

    // 1. Query students in this classroom with IdNo (CitizenId)
    const studentsQuery = `
        SELECT SR.No_Room, SR.StdNo, V.IdNo AS CitizenId,
               IsNull(V.PrefixNameFull,'') + V.Fname + ' ' + V.Lname AS StdName
        FROM Tabain.dbo.tblStudentRoom SR
        JOIN Tabain.dbo.v_student V ON SR.StdNo = V.StdNo
        WHERE SR.LavelNo + SR.DepartNo + SR.RoundNo + SR.[Year] + SR.Room = @classNo
        ORDER BY (CASE WHEN SR.No_Room LIKE '%[^0-9]%' OR LEN(SR.No_Room) > 4 THEN 9999 ELSE CAST(SR.No_Room AS INT) END), SR.StdNo
    `;
    const studentsResult = await executeSafeQuery(pool, studentsQuery, { classNo });
    const students = studentsResult.recordset;

    // 2. Query RCL Main (ReportCheckLearnMain)
    const rclQuery = `
        SELECT RCLNo, DateBegin, DateEnd, AmountWeek, AmountTeachPerWeek, AmountTeachAll, AmountAbsent, TeachWeekDay
        FROM Vichakarn.dbo.tblReportCheckLearnMain
        WHERE TeacherNo = @teacherNo AND SubNo = @subNo AND ClassNo = @classNo AND TermYear = @termYear
    `;
    const rclResult = await executeSafeQuery(pool, rclQuery, { teacherNo, subNo, classNo, termYear });
    const rcl = rclResult.recordset[0] || null;

    // 3. Query RCL Detail
    let rclDetailMap = new Map();
    if (rcl && rcl.RCLNo) {
        const rclDetResult = await executeSafeQuery(pool, `
            SELECT StdNo, AmountTimeLearnAll, AmountDayCut, DetailCut
            FROM Vichakarn.dbo.tblReportCheckLearnDetail
            WHERE RCLNo = @rclNo
        `, { rclNo: rcl.RCLNo });
        for (const d of rclDetResult.recordset) {
            rclDetailMap.set(d.StdNo, d);
        }
    }

    // 4. Query Timetable
    const ttQuery = `
        SELECT TT.DayNo, D.DayShortName, TT.TimeNo
        FROM Vichakarn.dbo.tblTimeTable TT
        LEFT JOIN Vichakarn.dbo.tblDay D ON TT.DayNo = D.DayNo
        WHERE TT.TeacherNo = @teacherNo AND TT.SubNo = @subNo AND TT.ClassNo = @classNo
          AND TT.Term = @term AND TT.[Year] = @year
        ORDER BY CAST(TT.DayNo AS INT), CAST(TT.TimeNo AS INT)
    `;
    const ttResult = await executeSafeQuery(pool, ttQuery, {
        teacherNo, subNo, classNo, term: String(term), year: String(year)
    });
    const timetable = ttResult.recordset;

    // 5. Query ALL Checked sessions (Union Desktop + Web)
    const checkedSessionsQuery = `
        SELECT DISTINCT CONVERT(VARCHAR(10), CM.DateInput, 120) AS DateStr, CD.TimeNo,
               MIN(CM.DateInput) AS DateInput
        FROM Government.dbo.tblStdLearnInClassMain CM
        INNER JOIN Government.dbo.tblStdLearnInClassDetail CD ON CM.SLICNo = CD.SLICNo
        WHERE CD.TeacherNo = @teacherNo
          AND CD.SubNo = @subNo
          AND CM.ClassNo = @classNo
          AND CM.TermYear = @termYear
          AND CD.TimeNo > 0
        GROUP BY CONVERT(VARCHAR(10), CM.DateInput, 120), CD.TimeNo
        UNION
        SELECT DISTINCT CONVERT(VARCHAR(10), DateInput, 120) AS DateStr, TimeNo,
               DateInput
        FROM Government.dbo.tblStdLearnInClassMain_Web
        WHERE TeacherNo = @teacherNo
          AND SubNo = @subNo
          AND ClassNo = @classNo
          AND (TermYear = @termYear OR TermYear IS NULL)
          AND TimeNo > 0
        ORDER BY DateStr, TimeNo
    `;
    const checkedSessionsResult = await executeSafeQuery(pool, checkedSessionsQuery, {
        teacherNo, subNo, classNo, termYear
    });
    const checkedSessions = checkedSessionsResult.recordset;
    const checkedSet = new Set(checkedSessions.map(s => `${s.DateStr}|${s.TimeNo}`));

    // 6. Query Attendance details (Desktop + Web)
    const detailsQuery = `
        SELECT CONVERT(VARCHAR(10), CM.DateInput, 120) AS DateStr, CD.TimeNo, CD.StdNo,
               LTRIM(RTRIM(CD.DintComeStdTypeInClass)) AS Status
        FROM Government.dbo.tblStdLearnInClassMain CM
        INNER JOIN Government.dbo.tblStdLearnInClassDetail CD ON CM.SLICNo = CD.SLICNo
        WHERE CD.TeacherNo = @teacherNo
          AND CD.SubNo = @subNo
          AND CM.ClassNo = @classNo
          AND CM.TermYear = @termYear
          AND CD.TimeNo > 0
    `;
    const detailsResult = await executeSafeQuery(pool, detailsQuery, {
        teacherNo, subNo, classNo, termYear
    });
    const attendanceMap = new Map();
    for (const d of detailsResult.recordset) {
        attendanceMap.set(`${d.DateStr}|${d.TimeNo}|${d.StdNo}`, d.Status || 'ม');
    }

    // 7. Query lesson content from Web logs
    const contentResult = await executeSafeQuery(pool, `
        SELECT CONVERT(VARCHAR(10), DateInput, 120) AS DateStr, TimeNo, Content
        FROM Government.dbo.tblStdLearnInClassMain_Web
        WHERE TeacherNo = @teacherNo AND SubNo = @subNo AND ClassNo = @classNo
          AND (TermYear = @termYear OR TermYear IS NULL) AND TimeNo > 0
    `, { teacherNo, subNo, classNo, termYear });
    const contentMap = new Map();
    for (const c of contentResult.recordset) {
        contentMap.set(`${c.DateStr}|${c.TimeNo}`, c.Content);
    }

    // Determine starting date
    let startDateStr = customDateBegin;
    if (!startDateStr) {
        if (checkedSessions.length > 0) {
            startDateStr = checkedSessions[0].DateStr;
        } else if (rcl && rcl.DateBegin) {
            startDateStr = new Date(rcl.DateBegin).toISOString().slice(0, 10);
        } else {
            startDateStr = new Date().toISOString().slice(0, 10);
        }
    }

    // Calculate timetable calendar (Weeks 1 to 20)
    const totalWeeks = parseInt(rcl?.AmountWeek || '20', 10);
    const [sY, sM, sD] = startDateStr.split('-').map(Number);
    const startObj = new Date(sY, sM - 1, sD);
    const dayOfWeek = (startObj.getDay() + 6) % 7; // Monday is 0, Sunday is 6
    const mondayWeek1 = new Date(startObj);
    mondayWeek1.setDate(mondayWeek1.getDate() - dayOfWeek);

    const allColumns = [];
    let periodSeq = 0;

    for (let w = 0; w < totalWeeks; w++) {
        const weekMonday = new Date(mondayWeek1);
        weekMonday.setDate(weekMonday.getDate() + (w * 7));

        if (timetable.length > 0) {
            for (const slot of timetable) {
                const dayOffset = (parseInt(slot.DayNo, 10) - 1);
                const slotDate = new Date(weekMonday);
                slotDate.setDate(slotDate.getDate() + dayOffset);

                const yr = slotDate.getFullYear();
                const mo = String(slotDate.getMonth() + 1).padStart(2, '0');
                const da = String(slotDate.getDate()).padStart(2, '0');
                const dateStr = `${yr}-${mo}-${da}`;
                const dateNum = slotDate.getDate();
                const mIdx = slotDate.getMonth();
                const yearThai = yr + 543;

                periodSeq++;
                const isChecked = checkedSet.has(`${dateStr}|${slot.TimeNo}`);
                const content = contentMap.get(`${dateStr}|${slot.TimeNo}`) || '';

                allColumns.push({
                    id: `p-${periodSeq}`,
                    periodSeq,
                    weekNo: w + 1,
                    dateStr,
                    dateNum,
                    monthName: THAI_MONTHS[mIdx],
                    monthShort: THAI_MONTHS_SHORT[mIdx],
                    monthKey: `${mIdx + 1}/${yearThai}`,
                    yearThai,
                    timeNo: slot.TimeNo,
                    dayShortName: slot.DayShortName,
                    isChecked,
                    content
                });
            }
        }
    }

    // Fallback if no timetable is defined in DB
    if (allColumns.length === 0) {
        checkedSessions.forEach((sess, idx) => {
            const d = new Date(sess.DateInput);
            const mIdx = d.getMonth();
            const yr = d.getFullYear();
            const yearThai = yr + 543;
            allColumns.push({
                id: `p-${idx + 1}`,
                periodSeq: idx + 1,
                weekNo: Math.floor(idx / 4) + 1,
                dateStr: sess.DateStr,
                dateNum: d.getDate(),
                monthName: THAI_MONTHS[mIdx],
                monthShort: THAI_MONTHS_SHORT[mIdx],
                monthKey: `${mIdx + 1}/${yearThai}`,
                yearThai,
                timeNo: sess.TimeNo,
                dayShortName: '',
                isChecked: true,
                content: contentMap.get(`${sess.DateStr}|${sess.TimeNo}`) || ''
            });
        });
    }

    const checkedColumns = allColumns.filter(c => c.isChecked);

    // Build student rows
    const studentRows = students.map((std, idx) => {
        const no = std.No_Room || String(idx + 1);
        let presentCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        const checks = allColumns.map(col => {
            let code = '';
            if (col.isChecked) {
                const raw = attendanceMap.get(`${col.dateStr}|${col.timeNo}|${std.StdNo}`);
                if (raw === 'ข') {
                    code = 'ข';
                    absentCount++;
                } else if (raw === 'ล' || raw === 'ป') {
                    code = raw;
                    leaveCount++;
                } else {
                    code = 'ม'; // Present matching MisSchool Academic
                    presentCount++;
                }
            }
            return {
                periodSeq: col.periodSeq,
                dateStr: col.dateStr,
                timeNo: col.timeNo,
                code
            };
        });

        const rclDet = rclDetailMap.get(std.StdNo);
        const totalTaught = checkedColumns.length;
        const percent = totalTaught > 0 ? ((presentCount / totalTaught) * 100).toFixed(1) : '100.0';

        return {
            no,
            stdNo: std.StdNo,
            citizenId: std.CitizenId || '',
            stdName: std.StdName,
            checks,
            summary: {
                present: presentCount,
                absent: absentCount,
                leave: leaveCount,
                totalTaught,
                totalScheduled: allColumns.length,
                percent,
                amountTimeLearnAll: rclDet?.AmountTimeLearnAll || (allColumns.length - absentCount),
                amountDayCut: rclDet?.AmountDayCut !== undefined ? rclDet.AmountDayCut : absentCount
            }
        };
    });

    return {
        students,
        rcl,
        timetable,
        checkedSessions,
        startDateStr,
        totalWeeks,
        allColumns,
        checkedColumns,
        studentRows
    };
}

// 6. ATTENDANCE MATRIX SHEET (สมุดบันทึกเวลาเรียนตารางเช็คชื่อ)
app.get('/api/teacher/attendance-sheet', requireTeacherAuth, async (req, res) => {
    try {
        const { term, year, subNo, classNo, dateBegin } = req.query;
        if (!term || !year || !subNo || !classNo) {
            return res.status(400).json({ error: 'กรุณาระบุภาคเรียน, ปีการศึกษา, รหัสวิชา และห้องเรียนให้ครบถ้วน' });
        }

        const pool = await getPool();
        const teacherNo = req.teacher.TeacherNo;

        // Security check: Verify that THIS teacher teaches this subject & class in this term/year
        const verifyQuery = `
            SELECT TOP 1 S.Subject,
                   COALESCE(
                       NULLIF(LTRIM(RTRIM(IsNull(tl.LavelName, '') + ' ' + SUBSTRING(T.ClassNo, 5, 1) + '/' + SUBSTRING(T.ClassNo, 6, CASE WHEN LEN(T.ClassNo) > 5 THEN LEN(T.ClassNo) - 5 ELSE 1 END) + ' ' + IsNull(td.DepartNamefull, ''))), ''),
                       T.ClassNo
                   ) AS ClassName
            FROM (
                SELECT TT.TeacherNo, TT.SubNo, TT.ClassNo, TT.Term, TT.[Year]
                FROM Vichakarn.dbo.tblTimeTable TT
                UNION
                SELECT TC.TeacherNo, TC.SubNo, 
                       (TC.LavelNo + TC.DepartNo + TC.RoundNo + TC.[Year] + TC.Room) AS ClassNo,
                       TC.sTerm AS Term, TC.sYear AS [Year]
                FROM Vichakarn.dbo.tblTeach TC
                WHERE TC.sTerm IS NOT NULL AND TC.sYear IS NOT NULL
            ) T
            INNER JOIN Vichakarn.dbo.tblSubject S ON T.SubNo = S.SubNo
            LEFT JOIN Basedata.dbo.tblLavel tl ON tl.LavelNo = SUBSTRING(T.ClassNo, 1, 1)
            LEFT JOIN Basedata.dbo.tblDepart td ON td.DepartNo = SUBSTRING(T.ClassNo, 2, 2)
            WHERE T.TeacherNo = @teacherNo
              AND T.Term = @term
              AND T.[Year] = @year
              AND T.SubNo = @subNo
              AND T.ClassNo = @classNo
        `;
        const verifyResult = await executeSafeQuery(pool, verifyQuery, {
            teacherNo,
            term: String(term),
            year: String(year),
            subNo: String(subNo),
            classNo: String(classNo)
        });

        if (verifyResult.recordset.length === 0) {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงวิชาหรือห้องเรียนนี้ หรือข้อมูลไม่ตรงกับตารางสอนของคุณ' });
        }

        const subjectInfo = verifyResult.recordset[0];

        const sheetData = await getAttendanceSheetData(
            pool,
            teacherNo,
            term,
            year,
            subNo,
            classNo,
            dateBegin
        );

        res.json({
            teacher: {
                teacherNo: req.teacher.TeacherNo,
                teacherName: req.teacher.TeacherName,
                department: req.teacher.DepartNameFull
            },
            info: {
                term,
                year,
                subNo,
                subjectName: subjectInfo.Subject,
                classNo,
                className: subjectInfo.ClassName,
                totalStudents: sheetData.students.length,
                totalScheduledPeriods: sheetData.allColumns.length,
                totalTaughtSessions: sheetData.checkedColumns.length,
                dateBegin: sheetData.startDateStr,
                amountWeek: sheetData.totalWeeks,
                amountTeachPerWeek: sheetData.rcl?.AmountTeachPerWeek || (sheetData.timetable.length ? sheetData.timetable.length : 4),
                amountTeachAll: sheetData.rcl?.AmountTeachAll || sheetData.allColumns.length,
                amountAbsentMax: sheetData.rcl?.AmountAbsent || Math.floor((sheetData.allColumns.length || 80) * 0.2),
                teachWeekDay: sheetData.rcl?.TeachWeekDay || sheetData.timetable.map(t => `${t.DayShortName} คาบ ${t.TimeNo}`).join(', ')
            },
            monthGroups: buildMonthGroups(sheetData.allColumns),
            columns: sheetData.allColumns,
            checkedMonthGroups: buildMonthGroups(sheetData.checkedColumns),
            checkedColumns: sheetData.checkedColumns,
            students: sheetData.studentRows
        });

    } catch (err) {
        console.error('Attendance Matrix error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงตารางเช็คชื่อ: ' + err.message });
    }
});

// 7. EXPORT ATTENDANCE MATRIX SHEET TO EXCEL
app.get('/api/teacher/attendance-sheet/export-excel', requireTeacherAuth, async (req, res) => {
    try {
        const { term, year, subNo, classNo, dateBegin, viewMode } = req.query;
        if (!term || !year || !subNo || !classNo) {
            return res.status(400).send('กรุณาระบุข้อมูลให้ครบถ้วน');
        }

        const pool = await getPool();
        const teacherNo = req.teacher.TeacherNo;

        const sheetData = await getAttendanceSheetData(
            pool,
            teacherNo,
            term,
            year,
            subNo,
            classNo,
            dateBegin
        );

        const useCols = (viewMode === 'checked') ? sheetData.checkedColumns : sheetData.allColumns;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('ตารางบันทึกเวลาเรียน');

        // Row 1: Title
        sheet.addRow([`วิทยาลัยเทคโนโลยีศรีราชา - สมุดบันทึกเวลาเรียนและการเข้าสอน`]);
        sheet.addRow([`วิชา: ${subNo} | ห้อง: ${classNo} | อาจารย์ผู้สอน: ${req.teacher.TeacherName} | ภาคเรียน: ${term}/${year} | เริ่ม: ${sheetData.startDateStr}`]);
        sheet.addRow([]); // Blank row 3

        // Row 4: Months Header
        const r4 = ['เลขที่', 'เลขประจำตัว', 'เลขบัตรประชาชน', 'ชื่อ - สกุล'];
        useCols.forEach(c => r4.push(`${c.monthShort}`));
        r4.push('มา', 'ขาด', 'ลา', 'ร้อยละ (%)');
        sheet.addRow(r4);

        // Row 5: Week / Date / Time
        const r5 = ['', '', '', ''];
        useCols.forEach(c => r5.push(`ส.${c.weekNo} (${c.dateNum}) คาบ ${c.timeNo}`));
        r5.push('', '', '', '');
        sheet.addRow(r5);

        // Student Data Rows
        sheetData.studentRows.forEach((std) => {
            const rData = [std.no, std.stdNo, std.citizenId, std.stdName];
            useCols.forEach(c => {
                const chk = std.checks.find(k => k.periodSeq === c.periodSeq);
                rData.push(chk ? chk.code : '');
            });
            rData.push(std.summary.present, std.summary.absent, std.summary.leave, `${std.summary.percent}%`);
            sheet.addRow(rData);
        });

        // Styling
        sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFF' } };
        sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
        sheet.getRow(5).font = { bold: true };
        sheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Attendance_${classNo}_${subNo}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Matrix Excel Export Error:', err);
        res.status(500).send('Error generating matrix excel: ' + err.message);
    }
});

// 8. Teaching Logs API (บันทึกการสอนประจำวัน / เนื้อหาที่สอน)
app.get('/api/teacher/teaching-logs', requireTeacherAuth, async (req, res) => {
    try {
        const { term, year, subNo, classNo } = req.query;
        if (!term || !year || !subNo || !classNo) {
            return res.status(400).json({ error: 'กรุณาระบุข้อมูลให้ครบถ้วน (term, year, subNo, classNo)' });
        }

        const pool = await getPool();
        const termYear = `${term}/${year}`;

        // Get Subject Name and Class Name
        const infoQuery = `
            SELECT S.SubNo, S.Subject,
                   COALESCE(
                       NULLIF(LTRIM(RTRIM(IsNull(tl.LavelName, '') + ' ' + SUBSTRING(@classNo, 5, 1) + '/' + SUBSTRING(@classNo, 6, CASE WHEN LEN(@classNo) > 5 THEN LEN(@classNo) - 5 ELSE 1 END) + ' ' + IsNull(td.DepartNamefull, ''))), ''),
                       @classNo
                   ) AS ClassName
            FROM Vichakarn.dbo.tblSubject S
            LEFT JOIN Basedata.dbo.tblLavel tl ON tl.LavelNo = SUBSTRING(@classNo, 1, 1)
            LEFT JOIN Basedata.dbo.tblDepart td ON td.DepartNo = SUBSTRING(@classNo, 2, 2)
            WHERE S.SubNo = @subNo
        `;
        const infoRes = await executeSafeQuery(pool, infoQuery, { subNo, classNo });
        const courseInfo = infoRes.recordset[0] || {
            SubNo: subNo,
            Subject: subNo,
            ClassName: classNo
        };

        // 1. Get attendance sheet calendar & all periods (1 to 80)
        let sheetData = null;
        try {
            sheetData = await getAttendanceSheetData(
                pool,
                req.teacher.TeacherNo,
                term,
                year,
                subNo,
                classNo
            );
        } catch (e) {
            console.warn('Could not fetch attendance calendar for teaching logs:', e.message);
        }

        const totalClassStudents = (sheetData && sheetData.students) ? sheetData.students.length : 0;

        // 2. Query entered web logs from tblStdLearnInClassMain_Web
        const logsQuery = `
            SELECT 
                CONVERT(VARCHAR(10), DateInput, 120) AS DateStr,
                DateInput, TimeNo, TimeName, Content, OrderWork, Note, Memo, AmountStudent, AmountAbsent
            FROM Government.dbo.tblStdLearnInClassMain_Web
            WHERE TeacherNo = @teacherNo
              AND SubNo = @subNo
              AND ClassNo = @classNo
              AND (TermYear = @termYear OR TermYear IS NULL)
            ORDER BY DateInput ASC, CAST(CASE WHEN ISNUMERIC(TimeNo) = 1 THEN TimeNo ELSE 0 END AS INT) ASC
        `;

        const logsRes = await executeSafeQuery(pool, logsQuery, {
            teacherNo: req.teacher.TeacherNo,
            subNo,
            classNo,
            termYear
        });

        const mode = req.query.mode || 'combined'; // 'combined' (1 ครั้ง/แผ่น) or 'single' (1 คาบ/แผ่น)
        const scope = req.query.scope || 'all';     // 'all' (ครบทุกคาบ) or 'recorded' (เฉพาะที่บันทึกแล้ว)

        // Index web logs by:
        // 1. `${dStr}|${timeNo}` for exact period record
        // 2. `${dStr}|all` for general / fallback record
        const webLogsByPeriod = new Map();
        const webLogsByDate = new Map();

        for (const r of logsRes.recordset) {
            const dStr = r.DateStr;
            const tNo = String(r.TimeNo !== null && r.TimeNo !== undefined ? r.TimeNo : '0');
            const tot = parseInt(r.AmountStudent) || 0;
            const abs = (r.AmountAbsent !== null && r.AmountAbsent !== undefined && r.AmountAbsent !== '')
                ? parseInt(r.AmountAbsent)
                : null;

            const entry = {
                dateStr: dStr,
                timeNo: tNo,
                content: (r.Content || '').trim(),
                orderWork: (r.OrderWork || '').trim(),
                note: (r.Note || r.Memo || '').trim(),
                amountStudent: tot,
                amountAbsent: abs
            };

            webLogsByPeriod.set(`${dStr}|${tNo}`, entry);
            if (!webLogsByDate.has(dStr)) {
                webLogsByDate.set(dStr, []);
            }
            webLogsByDate.get(dStr).push(entry);
        }

        let logs = [];
        let sessionIdx = 1;

        if (sheetData && sheetData.allColumns && sheetData.allColumns.length > 0) {
            if (mode === 'single') {
                // ==========================================
                // MODE: SINGLE PERIOD (1 คาบเดี่ยว = 1 แผ่น A4)
                // ==========================================
                for (const col of sheetData.allColumns) {
                    const [yr, mo, da] = col.dateStr.split('-').map(Number);
                    const monthFull = THAI_MONTHS[mo - 1] || '';
                    const yearThai = yr + 543;
                    const dateThaiFull = `${da} ${monthFull} ${yearThai}`;

                    // Look up specific period record first, fallback to '0' (all periods)
                    const exactLog = webLogsByPeriod.get(`${col.dateStr}|${col.timeNo}`) || webLogsByPeriod.get(`${col.dateStr}|0`);

                    let content = '';
                    let orderWork = '';
                    let note = '';
                    let hasRecord = false;

                    if (exactLog) {
                        content = exactLog.content || '';
                        orderWork = exactLog.orderWork || '';
                        note = exactLog.note || '';
                        if (content || orderWork || note || exactLog.amountAbsent !== null || col.isChecked) {
                            hasRecord = true;
                        }
                    }

                    // Count absent from sheet student checks if available
                    let actualAbsentFromChecks = 0;
                    let hasAnyCheck = false;
                    if (sheetData.studentRows) {
                        for (const std of sheetData.studentRows) {
                            const chk = std.checks.find(k => k.periodSeq === col.periodSeq);
                            if (chk && chk.code) {
                                hasAnyCheck = true;
                                if (chk.code === 'ข') actualAbsentFromChecks++;
                            }
                        }
                    }

                    if (scope === 'recorded' && !hasRecord && !hasAnyCheck) {
                        continue; // Skip periods with no record if user only wants recorded ones
                    }

                    let totalStudents = '';
                    let absentStudents = '';
                    let presentStudents = '';

                    if (hasRecord || hasAnyCheck) {
                        totalStudents = (exactLog && exactLog.amountStudent > 0) ? exactLog.amountStudent : (totalClassStudents || '');
                        if (exactLog && exactLog.amountAbsent !== null) {
                            absentStudents = exactLog.amountAbsent;
                        } else if (hasAnyCheck) {
                            absentStudents = actualAbsentFromChecks;
                        } else {
                            absentStudents = 0;
                        }

                        if (totalStudents !== '' && absentStudents !== '') {
                            presentStudents = Math.max(0, parseInt(totalStudents) - parseInt(absentStudents));
                        }
                    }

                    logs.push({
                        index: sessionIdx++,
                        date: col.dateStr,
                        dateThai: dateThaiFull,
                        periods: `${col.periodSeq}`,
                        content,
                        orderWork,
                        note,
                        totalStudents,
                        absentStudents,
                        presentStudents
                    });
                }
            } else {
                // ==========================================
                // MODE: COMBINED DOUBLE PERIODS (1 ครั้ง = 1 แผ่น A4)
                // ==========================================
                // Group columns by Date
                const sessionMap = new Map();
                for (const col of sheetData.allColumns) {
                    if (!sessionMap.has(col.dateStr)) {
                        sessionMap.set(col.dateStr, {
                            dateStr: col.dateStr,
                            dayShortName: col.dayShortName,
                            weekNo: col.weekNo,
                            cols: []
                        });
                    }
                    sessionMap.get(col.dateStr).cols.push(col);
                }

                for (const s of sessionMap.values()) {
                    const cols = s.cols;
                    const pMin = cols[0].periodSeq;
                    const pMax = cols[cols.length - 1].periodSeq;
                    const periodsText = pMin === pMax ? `${pMin}` : `${pMin} - ${pMax}`;

                    const [yr, mo, da] = s.dateStr.split('-').map(Number);
                    const monthFull = THAI_MONTHS[mo - 1] || '';
                    const yearThai = yr + 543;
                    const dateThaiFull = `${da} ${monthFull} ${yearThai}`;

                    const entriesForDate = webLogsByDate.get(s.dateStr) || [];
                    const generalLog = webLogsByPeriod.get(`${s.dateStr}|0`);

                    let contentParts = [];
                    let orderWorkParts = [];
                    let noteParts = [];
                    let maxTotal = 0;
                    let absentCount = null;
                    let hasRecord = false;
                    let hasAnyCheck = false;
                    let checkAbsentCount = 0;

                    // Check each period in this session
                    for (const c of cols) {
                        const pLog = webLogsByPeriod.get(`${s.dateStr}|${c.timeNo}`) || generalLog;
                        if (pLog) {
                            if (pLog.amountStudent > 0 && pLog.amountStudent > maxTotal) {
                                maxTotal = pLog.amountStudent;
                            }
                            if (pLog.amountAbsent !== null) {
                                if (absentCount === null || pLog.amountAbsent > absentCount) {
                                    absentCount = pLog.amountAbsent;
                                }
                            }
                            if (pLog.content) {
                                contentParts.push({ periodSeq: c.periodSeq, text: pLog.content });
                            }
                            if (pLog.orderWork) {
                                orderWorkParts.push({ periodSeq: c.periodSeq, text: pLog.orderWork });
                            }
                            if (pLog.note) {
                                noteParts.push({ periodSeq: c.periodSeq, text: pLog.note });
                            }
                            if (pLog.content || pLog.orderWork || pLog.note || pLog.amountAbsent !== null || c.isChecked) {
                                hasRecord = true;
                            }
                        }

                        if (sheetData.studentRows) {
                            let pAbsent = 0;
                            let pHasCheck = false;
                            for (const std of sheetData.studentRows) {
                                const chk = std.checks.find(k => k.periodSeq === c.periodSeq);
                                if (chk && chk.code) {
                                    pHasCheck = true;
                                    if (chk.code === 'ข') pAbsent++;
                                }
                            }
                            if (pHasCheck) {
                                hasAnyCheck = true;
                                if (pAbsent > checkAbsentCount) checkAbsentCount = pAbsent;
                            }
                        }
                    }

                    // Format Content: If both periods have different content, label them!
                    let finalContent = '';
                    if (contentParts.length > 0) {
                        const uniqueTexts = [...new Set(contentParts.map(cp => cp.text))];
                        if (uniqueTexts.length === 1) {
                            finalContent = uniqueTexts[0];
                        } else {
                            finalContent = contentParts.map(cp => `คาบที่ ${cp.periodSeq}: ${cp.text}`).join('\n');
                        }
                    }

                    // Format OrderWork:
                    let finalOrderWork = '';
                    if (orderWorkParts.length > 0) {
                        const uniqueTexts = [...new Set(orderWorkParts.map(op => op.text))];
                        if (uniqueTexts.length === 1) {
                            finalOrderWork = uniqueTexts[0];
                        } else {
                            finalOrderWork = orderWorkParts.map(op => `คาบที่ ${op.periodSeq}: ${op.text}`).join('\n');
                        }
                    }

                    // Format Note:
                    let finalNote = '';
                    if (noteParts.length > 0) {
                        const uniqueTexts = [...new Set(noteParts.map(np => np.text))];
                        if (uniqueTexts.length === 1) {
                            finalNote = uniqueTexts[0];
                        } else {
                            finalNote = noteParts.map(np => `คาบที่ ${np.periodSeq}: ${np.text}`).join('\n');
                        }
                    }

                    if (scope === 'recorded' && !hasRecord && !hasAnyCheck) {
                        continue; // Skip unrecorded sessions if scope is recorded
                    }

                    let totalStudents = '';
                    let absentStudents = '';
                    let presentStudents = '';

                    if (hasRecord || hasAnyCheck) {
                        totalStudents = maxTotal || totalClassStudents || '';
                        if (absentCount !== null) {
                            absentStudents = absentCount;
                        } else if (hasAnyCheck) {
                            absentStudents = checkAbsentCount;
                        } else {
                            absentStudents = 0;
                        }

                        if (totalStudents !== '' && absentStudents !== '') {
                            presentStudents = Math.max(0, parseInt(totalStudents) - parseInt(absentStudents));
                        }
                    }

                    logs.push({
                        index: sessionIdx++,
                        date: s.dateStr,
                        dateThai: dateThaiFull,
                        periods: periodsText,
                        content: finalContent,
                        orderWork: finalOrderWork,
                        note: finalNote,
                        totalStudents,
                        absentStudents,
                        presentStudents
                    });
                }
            }
        } else {
            // Fallback if no timetable found in database
            for (const [dStr, entries] of webLogsByDate.entries()) {
                const [yr, mo, da] = dStr.split('-').map(Number);
                const monthFull = THAI_MONTHS[mo - 1] || '';
                const yearThai = yr + 543;
                const dateThaiFull = `${da} ${monthFull} ${yearThai}`;

                const g = entries[0] || {};
                const totalStudents = g.amountStudent || totalClassStudents || '';
                const absentStudents = g.amountAbsent !== null ? g.amountAbsent : '';
                const presentStudents = (totalStudents !== '' && absentStudents !== '') ? Math.max(0, parseInt(totalStudents) - parseInt(absentStudents)) : '';

                logs.push({
                    index: sessionIdx++,
                    date: dStr,
                    dateThai: dateThaiFull,
                    periods: `1 - 2`,
                    content: g.content || '',
                    orderWork: g.orderWork || '',
                    note: g.note || '',
                    totalStudents,
                    absentStudents,
                    presentStudents
                });
            }
        }

        res.json({
            info: {
                subNo: courseInfo.SubNo,
                subjectName: courseInfo.Subject,
                classNo,
                className: courseInfo.ClassName,
                term,
                year,
                teacherName: req.teacher.TeacherName || req.teacher.TeacherNo
            },
            totalSessions: logs.length,
            logs
        });
    } catch (err) {
        console.error('Teaching Logs API Error:', err);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลบันทึกการสอน: ' + err.message });
    }
});

// Fallback to index.html (React client/dist if built, otherwise public)
app.use((req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (fs.existsSync(path.join(clientDist, 'index.html'))) {
        res.sendFile(path.join(clientDist, 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Teacher Daily Teaching Report Web Service (Read-Only)`);
    console.log(`  Running on: http://localhost:${PORT}`);
    console.log(`====================================================`);
});
