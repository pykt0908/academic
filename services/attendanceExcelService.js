const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const THAI_MONTHS_FULL = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Returns all weekdays (Mon-Fri) in a given month and CE year
 */
function getWeekdaysInMonth(yearCE, monthNum) {
    const weekdays = [];
    const daysInMonth = new Date(yearCE, monthNum, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(yearCE, monthNum - 1, d);
        const dayOfWeek = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            weekdays.push({
                dayNum: d,
                dateStr: `${yearCE}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                dayOfWeek
            });
        }
    }
    return weekdays;
}

/**
 * Build Student Affairs Attendance Sheet (Matching user's exact physical form)
 * รูปแบบ: สถิติการขาดเรียนของนักศึกษา (ฝ่ายปกครอง) หรือ รายงานสถิติการเข้าสาย รายเดือน
 */
function buildStudentAffairsMonthlyWorksheet(wb, classData, targetMonthNum, sheetTitle, reportType = 'absence') {
    const { info, students, attRecords, notInRowSet, rowCheckedDates } = classData;
    const isTardyReport = reportType === 'tardy';
    const yearCE = info.year > 2500 ? (parseInt(info.year) - 543) : parseInt(info.year);
    const yearThai = info.year > 2500 ? info.year : (parseInt(info.year) + 543);
    const monthName = THAI_MONTHS_FULL[targetMonthNum] || '';

    // Sheet Name (Max 31 chars, sanitized)
    const rawName = sheetTitle || `${info.className || info.classNo} ${monthName}`;
    const cleanSheetName = rawName.replace(/[:\\/?*\[\]]/g, '_').substring(0, 30);
    let finalSheetName = cleanSheetName;
    let counter = 1;
    while (wb.getWorksheet(finalSheetName)) {
        finalSheetName = `${cleanSheetName.substring(0, 27)}_${counter}`;
        counter++;
    }

    const ws = wb.addWorksheet(finalSheetName);

    // Page setup: A4 Landscape
    ws.pageSetup = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
    };

    // Embed Logo in B1:B4 if available
    const logoPaths = [
        path.join(__dirname, '../client/public/img/logo.png'),
        path.join(__dirname, '../public/img/logo.png'),
        path.join(__dirname, '../dist/img/logo.png')
    ];
    for (const lp of logoPaths) {
        if (fs.existsSync(lp)) {
            try {
                const logoId = wb.addImage({
                    buffer: fs.readFileSync(lp),
                    extension: 'png'
                });
                ws.addImage(logoId, {
                    tl: { col: 1.2, row: 0.2 },
                    ext: { width: 56, height: 56 }
                });
                break;
            } catch (e) {
                // Ignore logo read error
            }
        }
    }

    // Weekdays of this month
    const weekdays = getWeekdaysInMonth(yearCE, targetMonthNum);

    // Group attendance records by student and date to apply daily rule:
    // "แค่มาแค่คาบเดียว ก็นับว่ามา ('/')" - จะนับ 'ข' ก็ต่อเมื่อไม่ได้มาเรียนเลยในวันนั้น
    const studentDayPeriods = new Map();
    const checkedDates = new Set();

    (attRecords || []).forEach(r => {
        checkedDates.add(r.DateStr);
        const sId = String(r.StdNo).trim();
        const key = `${sId}|${r.DateStr}`;
        if (!studentDayPeriods.has(key)) {
            studentDayPeriods.set(key, []);
        }
        studentDayPeriods.get(key).push(r.Status);
    });

    function getStudentDayStatus(sId, dateStr) {
        const key = `${sId}|${dateStr}`;
        const periods = studentDayPeriods.get(key) || [];
        const isAbsentFromRow = notInRowSet && notInRowSet.has(key);
        const dayHasData = checkedDates.has(dateStr) || (rowCheckedDates && rowCheckedDates.has(dateStr));

        if (!dayHasData && periods.length === 0) {
            return '';
        }

        const hasPresent = periods.some(st => st === 'ม' || st === '/');
        const hasSick = periods.some(st => st === 'ป');
        const hasLeave = periods.some(st => st === 'ล');
        const allAbsent = periods.length > 0 && periods.every(st => st === 'ข');

        if (isTardyReport) {
            // เงื่อนไขรายงานการเข้าสาย:
            // 1. ถ้าข้อมูลเช็คแถวเป็น ขาด (อยู่ใน tblInputStudentNotInRow)
            if (isAbsentFromRow) {
                // มีการเช็คชื่อในรายวิชาอื่น ๆ หมายความว่า "สาย" ('ส')
                if (hasPresent) {
                    return 'ส';
                }
                // ถ้ามีการบันทึกเป็นลา ก็คือ ลา ('ล') หรือ ป่วย ('ป')
                if (hasSick) return 'ป';
                if (hasLeave) return 'ล';
                // ถ้าขาดในเช็คแถว แล้ววิชาอื่น ๆ ก็ขาด (หรือไม่ได้บันทึกมาเรียนเลย) ก็คือ ขาด ('ข')
                return 'ข';
            }

            // 2. ไม่ได้ขาดเช็คแถว (เข้าแถวปกติ)
            if (hasSick) return 'ป';
            if (hasLeave) return 'ล';
            if (allAbsent) return 'ข';
            if (hasPresent || (rowCheckedDates && rowCheckedDates.has(dateStr))) return '/';
            return checkedDates.has(dateStr) ? '/' : '';
        } else {
            // เงื่อนไขรายงานสถิติการขาดเรียน:
            if (periods.length === 0) {
                return checkedDates.has(dateStr) ? '/' : '';
            }
            if (hasPresent) {
                return '/';
            }
            if (periods.some(st => st === 'ข')) {
                return 'ข';
            }
            if (hasSick) return 'ป';
            if (hasLeave) return 'ล';
            return '/';
        }
    }

    // Header Styling
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } }; // Soft periwinkle blue
    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    // ==========================================
    // 1. TOP HEADER BLOCK (Rows 1 - 4)
    // ==========================================
    ws.getCell('C1').value = 'วิทยาลัยเทคโนโลยีศรีราชา';
    ws.getCell('C1').font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FF000000' } };

    ws.getCell('C2').value = 'งานปกครองนักเรียนนักศึกษา ฝ่ายพัฒนากิจการนักศึกษา';
    ws.getCell('C2').font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF111827' } };

    ws.getCell('C3').value = isTardyReport ? 'รายงานสถิติการเข้าสายและการขาดเรียนของนักศึกษา' : 'สถิติการขาดเรียนของนักศึกษา';
    ws.getCell('C3').font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF111827' } };

    ws.getCell('C4').value = `ปีการศึกษา ${info.term}/${yearThai}`;
    ws.getCell('C4').font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FF334155' } };

    // Column calculation for table headers
    const dateStartCol = 6;
    const dateEndCol = dateStartCol + weekdays.length - 1;
    const absStartCol = dateEndCol + 1;
    const summaryColsCount = isTardyReport ? 4 : 3;
    const noteCol = absStartCol + summaryColsCount;

    // Website link at top right (aligned with noteCol)
    const linkColLetter = ws.getColumn(noteCol).letter;
    ws.getCell(`${linkColLetter}2`).value = {
        text: 'www.technosriracha.ac.th',
        hyperlink: 'https://www.technosriracha.ac.th'
    };
    ws.getCell(`${linkColLetter}2`).font = { name: 'Sarabun', size: 9, color: { argb: 'FF0000FF' }, underline: true };
    ws.getCell(`${linkColLetter}2`).alignment = { horizontal: 'right', vertical: 'middle' };

    // ==========================================
    // 2. ROW 5: Classroom Info & Month Label
    // ==========================================
    const levelClass = info.levelClass || info.className || '';
    const departName = info.departName || '';
    const roundName = info.roundName || 'เช้า';

    ws.getCell('A5').value = `ระดับชั้น ${levelClass} สาขา ${departName} รอบ ${roundName}`;
    ws.getCell('A5').font = { name: 'Sarabun', size: 10, bold: true };

    const monthLabelCol = ws.getColumn(Math.max(1, noteCol - 3)).letter;
    ws.getCell(`${monthLabelCol}5`).value = `ประจำเดือน ${monthName} ${yearThai}`;
    ws.getCell(`${monthLabelCol}5`).font = { name: 'Sarabun', size: 10, bold: true };
    ws.getCell(`${monthLabelCol}5`).alignment = { horizontal: 'right', vertical: 'middle' };

    // ==========================================
    // 3. ROWS 6 & 7: TABLE HEADERS
    // ==========================================
    ws.mergeCells('A6:A7');
    ws.getCell('A6').value = 'เลขที่';

    ws.mergeCells('B6:B7');
    ws.getCell('B6').value = 'รหัสนักศึกษา';

    ws.mergeCells('C6:C7');
    ws.getCell('C6').value = 'ชื่อ-สกุล';

    ws.mergeCells('D6:D7');
    ws.getCell('D6').value = 'เพศ';

    ws.mergeCells('E6:E7');
    const hmCell = ws.getCell('E6');
    hmCell.value = 'โ\nฮ\nม\nรู\nม';
    hmCell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

    // Days Header (Row 6)
    ws.mergeCells(6, dateStartCol, 6, dateEndCol);
    const dtHdr = ws.getCell(6, dateStartCol);
    dtHdr.value = 'วันที่';
    dtHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    // Days Subheaders (Row 7: 1, 2, 3, 4, 7, 8, ...)
    weekdays.forEach((w, idx) => {
        const c = ws.getCell(7, dateStartCol + idx);
        c.value = w.dayNum;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.font = { name: 'Sarabun', size: 8.5, bold: true };
        c.fill = headerFill;
    });

    // Summary Headers (Row 6 & 7)
    ws.mergeCells(6, absStartCol, 6, absStartCol + summaryColsCount - 1);
    const absHdr = ws.getCell(6, absStartCol);
    absHdr.value = isTardyReport ? 'จำนวนครั้ง' : 'จำนวนที่ขาด';
    absHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    const absSub = isTardyReport ? ['สาย', 'ขาด', 'ลา', 'รวม'] : ['ขาด', 'ลา', 'รวม'];
    absSub.forEach((sh, idx) => {
        const c = ws.getCell(7, absStartCol + idx);
        c.value = sh;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.font = { name: 'Sarabun', size: 9, bold: true };
        c.fill = headerFill;
    });

    // Note Header
    ws.mergeCells(6, noteCol, 7, noteCol);
    const noteHdr = ws.getCell(6, noteCol);
    noteHdr.value = 'หมายเหตุ';
    noteHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    // Style Fixed Headers A6..E6 & Groups
    ['A6', 'B6', 'C6', 'D6', 'E6'].forEach(addr => {
        const c = ws.getCell(addr);
        c.fill = headerFill;
        c.font = { name: 'Sarabun', size: 9.5, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    hmCell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

    dtHdr.fill = headerFill;
    dtHdr.font = { name: 'Sarabun', size: 10, bold: true };
    absHdr.fill = headerFill;
    absHdr.font = { name: 'Sarabun', size: 10, bold: true };
    noteHdr.fill = headerFill;
    noteHdr.font = { name: 'Sarabun', size: 9.5, bold: true };

    // ==========================================
    // 4. ROWS 8..N: STUDENT DATA ROWS
    // ==========================================
    const startLetter = ws.getColumn(dateStartCol).letter;
    const endLetter = ws.getColumn(dateEndCol).letter;

    let curRow = 8;
    students.forEach((std, sIdx) => {
        const r = ws.getRow(curRow);
        const sId = String(std.StdNo).trim();
        const prefix = std.PrefixNameFull || '';
        const gender = std.gender || ((prefix.includes('นาย') || prefix.includes('เด็กชาย')) ? 'ชาย' : 'หญิง');

        r.getCell(1).value = std.no || std.No_Room || (sIdx + 1);
        r.getCell(2).value = sId;
        r.getCell(3).value = std.name || std.StdName;
        r.getCell(4).value = gender;
        r.getCell(5).value = ''; // โฮมรูม

        r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

        let tardyCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        weekdays.forEach((w, idx) => {
            const cell = r.getCell(dateStartCol + idx);
            const st = getStudentDayStatus(sId, w.dateStr);
            let displayChar = '';

            if (st === 'ส') {
                displayChar = 'ส';
                tardyCount++;
                cell.font = { name: 'Sarabun', size: 9, bold: true, color: { argb: 'FFD97706' } }; // Gold/Amber ส
            } else if (st === 'ข') {
                displayChar = 'ข';
                absentCount++;
                cell.font = { name: 'Sarabun', size: 9, bold: true, color: { argb: 'FFFF0000' } }; // Red ข
            } else if (st === 'ล') {
                displayChar = 'ล';
                leaveCount++;
                cell.font = { name: 'Sarabun', size: 9, bold: true, color: { argb: 'FFB45309' } };
            } else if (st === 'ป') {
                displayChar = 'ป';
                leaveCount++;
                cell.font = { name: 'Sarabun', size: 9, bold: true, color: { argb: 'FFC2410C' } };
            } else if (st === '/' || st === 'ม') {
                displayChar = '/';
                cell.font = { name: 'Sarabun', size: 9, color: { argb: 'FF000000' } };
            }

            cell.value = displayChar;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Summary columns: ใช้สูตร Excel เพื่อให้อัปเดตอัตโนมัติเมื่อมีการแก้ไขข้อมูล
        const dateRange = `${startLetter}${curRow}:${endLetter}${curRow}`;
        if (isTardyReport) {
            // 4 คอลัมน์: สาย, ขาด, ลา, รวม
            const tardyColLetter = ws.getColumn(absStartCol).letter;
            const absentColLetter = ws.getColumn(absStartCol + 1).letter;
            const leaveColLetter = ws.getColumn(absStartCol + 2).letter;

            r.getCell(absStartCol).value = {
                formula: `COUNTIF(${dateRange},"ส")`,
                result: tardyCount
            };
            r.getCell(absStartCol + 1).value = {
                formula: `COUNTIF(${dateRange},"ข")`,
                result: absentCount
            };
            r.getCell(absStartCol + 2).value = {
                formula: `COUNTIF(${dateRange},"ล")+COUNTIF(${dateRange},"ป")`,
                result: leaveCount
            };
            r.getCell(absStartCol + 3).value = {
                formula: `SUM(${tardyColLetter}${curRow}:${leaveColLetter}${curRow})`,
                result: tardyCount + absentCount + leaveCount
            };

            for (let i = 0; i < 4; i++) {
                const c = r.getCell(absStartCol + i);
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.font = { name: 'Sarabun', size: 9.5 };
                if (i === 0 && tardyCount > 0) {
                    c.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFD97706' } };
                } else if (i === 1 && absentCount > 0) {
                    c.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFFF0000' } };
                }
            }
        } else {
            // 3 คอลัมน์: ขาด, ลา, รวม
            const absLetter = ws.getColumn(absStartCol).letter;
            const leaveLetter = ws.getColumn(absStartCol + 1).letter;

            r.getCell(absStartCol).value = {
                formula: `COUNTIF(${dateRange},"ข")`,
                result: absentCount
            };
            r.getCell(absStartCol + 1).value = {
                formula: `COUNTIF(${dateRange},"ล")+COUNTIF(${dateRange},"ป")`,
                result: leaveCount
            };
            r.getCell(absStartCol + 2).value = {
                formula: `SUM(${absLetter}${curRow}:${leaveLetter}${curRow})`,
                result: absentCount + leaveCount
            };

            for (let i = 0; i < 3; i++) {
                const c = r.getCell(absStartCol + i);
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.font = { name: 'Sarabun', size: 9.5 };
                if (i === 0 && absentCount > 0) {
                    c.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFFF0000' } };
                }
            }
        }

        r.getCell(noteCol).value = '';
        curRow++;
    });

    // ==========================================
    // 5. BORDERS & ROW HEIGHTS
    // ==========================================
    const totalCols = noteCol;
    for (let rw = 6; rw < curRow; rw++) {
        const row = ws.getRow(rw);
        row.height = rw <= 7 ? 20 : 18;
        for (let cl = 1; cl <= totalCols; cl++) {
            const cell = row.getCell(cl);
            cell.border = thinBorder;
            if (!cell.font) {
                cell.font = { name: 'Sarabun', size: 9 };
            }
        }
    }

    // ==========================================
    // 6. COLUMN WIDTHS (Matching form layout)
    // ==========================================
    ws.getColumn(1).width = 5.5;  // เลขที่
    ws.getColumn(2).width = 14;   // รหัสนักศึกษา
    ws.getColumn(3).width = 25;   // ชื่อ-สกุล
    ws.getColumn(4).width = 6.5;  // เพศ
    ws.getColumn(5).width = 6.5;  // โฮมรูม
    for (let cl = dateStartCol; cl <= dateEndCol; cl++) {
        ws.getColumn(cl).width = 3.6; // วันที่
    }
    if (isTardyReport) {
        ws.getColumn(absStartCol).width = 5.5;     // สาย
        ws.getColumn(absStartCol + 1).width = 5.5; // ขาด
        ws.getColumn(absStartCol + 2).width = 5.5; // ลา
        ws.getColumn(absStartCol + 3).width = 5.5; // รวม
        ws.getColumn(noteCol).width = 11;          // หมายเหตุ
    } else {
        ws.getColumn(absStartCol).width = 6.5;     // ขาด
        ws.getColumn(absStartCol + 1).width = 6.5; // ลา
        ws.getColumn(absStartCol + 2).width = 6.5; // รวม
        ws.getColumn(noteCol).width = 12;          // หมายเหตุ
    }

    return ws;
}

/**
 * Generates structured JSON preview data for web viewing (matching the Excel sheet layout)
 */
function getStudentAffairsMonthlyPreview(classData, targetMonthNum, reportType = 'absence') {
    const { info, students, attRecords, notInRowSet, rowCheckedDates } = classData;
    const isTardyReport = reportType === 'tardy';
    const yearCE = info.year > 2500 ? (parseInt(info.year) - 543) : parseInt(info.year);
    const yearThai = info.year > 2500 ? info.year : (parseInt(info.year) + 543);
    const monthName = THAI_MONTHS_FULL[targetMonthNum] || '';
    const mYearCE = (String(info.term) === '2' && targetMonthNum <= 4) ? (yearCE + 1) : yearCE;

    const weekdays = getWeekdaysInMonth(mYearCE, targetMonthNum);

    const studentDayPeriods = new Map();
    const checkedDates = new Set();

    (attRecords || []).forEach(r => {
        checkedDates.add(r.DateStr);
        const sId = String(r.StdNo).trim();
        const key = `${sId}|${r.DateStr}`;
        if (!studentDayPeriods.has(key)) {
            studentDayPeriods.set(key, []);
        }
        studentDayPeriods.get(key).push(r.Status);
    });

    function getStudentDayStatus(sId, dateStr) {
        const key = `${sId}|${dateStr}`;
        const periods = studentDayPeriods.get(key) || [];
        const isAbsentFromRow = notInRowSet && notInRowSet.has(key);
        const dayHasData = checkedDates.has(dateStr) || (rowCheckedDates && rowCheckedDates.has(dateStr));

        if (!dayHasData && periods.length === 0) {
            return '';
        }

        const hasPresent = periods.some(st => st === 'ม' || st === '/');
        const hasSick = periods.some(st => st === 'ป');
        const hasLeave = periods.some(st => st === 'ล');
        const allAbsent = periods.length > 0 && periods.every(st => st === 'ข');

        if (isTardyReport) {
            if (isAbsentFromRow) {
                if (hasPresent) return 'ส';
                if (hasSick) return 'ป';
                if (hasLeave) return 'ล';
                return 'ข';
            }
            if (hasSick) return 'ป';
            if (hasLeave) return 'ล';
            if (allAbsent) return 'ข';
            if (hasPresent || (rowCheckedDates && rowCheckedDates.has(dateStr))) return '/';
            return checkedDates.has(dateStr) ? '/' : '';
        } else {
            if (periods.length === 0) return checkedDates.has(dateStr) ? '/' : '';
            if (hasPresent) return '/';
            if (periods.some(st => st === 'ข')) return 'ข';
            if (hasSick) return 'ป';
            if (hasLeave) return 'ล';
            return '/';
        }
    }

    let maleCount = 0;
    let femaleCount = 0;
    let totalTardy = 0;
    let totalAbsent = 0;
    let totalLeave = 0;

    const studentRows = (students || []).map((std, sIdx) => {
        const sId = String(std.StdNo).trim();
        const prefix = std.PrefixNameFull || '';
        const isMale = std.gender ? std.gender === 'ชาย' : (prefix.includes('นาย') || prefix.includes('เด็กชาย'));
        const gender = isMale ? 'ชาย' : 'หญิง';
        if (isMale) maleCount++; else femaleCount++;

        let tardyCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        const days = {};
        weekdays.forEach(w => {
            const st = getStudentDayStatus(sId, w.dateStr);
            days[w.dayNum] = st;
            if (st === 'ส') tardyCount++;
            else if (st === 'ข') absentCount++;
            else if (st === 'ล' || st === 'ป') leaveCount++;
        });

        totalTardy += tardyCount;
        totalAbsent += absentCount;
        totalLeave += leaveCount;

        return {
            no: std.no || std.No_Room || (sIdx + 1),
            stdNo: sId,
            name: std.name || std.StdName,
            gender,
            days,
            summary: {
                tardy: tardyCount,
                absent: absentCount,
                leave: leaveCount,
                total: isTardyReport ? (tardyCount + absentCount + leaveCount) : (absentCount + leaveCount)
            }
        };
    });

    return {
        info: {
            ...info,
            yearThai,
            monthName,
            monthNum: targetMonthNum
        },
        reportType,
        weekdays,
        students: studentRows,
        totals: {
            maleCount,
            femaleCount,
            totalStudents: studentRows.length,
            totalTardy,
            totalAbsent,
            totalLeave,
            grandTotal: isTardyReport ? (totalTardy + totalAbsent + totalLeave) : (totalAbsent + totalLeave)
        }
    };
}

module.exports = {
    buildStudentAffairsMonthlyWorksheet,
    getStudentAffairsMonthlyPreview,
    getWeekdaysInMonth,
    THAI_MONTHS_FULL
};
