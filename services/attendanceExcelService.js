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
 * รูปแบบ: สถิติการขาดเรียนของนักศึกษา (ฝ่ายปกครอง) รายเดือน เลือกเดือนได้
 */
function buildStudentAffairsMonthlyWorksheet(wb, classData, targetMonthNum, sheetTitle) {
    const { info, students, attRecords } = classData;
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
        const periods = studentDayPeriods.get(key);
        if (!periods || periods.length === 0) {
            // หากวันนั้นโรงเรียนมีการเช็คชื่อ แต่ไม่มีประวัติขาด/ลา ถือว่ามาเรียนปกติ
            return checkedDates.has(dateStr) ? '/' : '';
        }

        // เงื่อนไข: แค่มาแค่คาบเดียว (มี 'ม' หรือ '/') ก็นับว่ามาเรียน ('/')
        const hasPresent = periods.some(st => st === 'ม' || st === '/');
        if (hasPresent) {
            return '/';
        }

        // หากไม่ได้เข้าเรียนเลยสักคาบ:
        // ตรวจสอบว่ามีขาดเรียน ('ข') หรือไม่
        if (periods.some(st => st === 'ข')) {
            return 'ข';
        }

        // ตรวจสอบว่าเป็นการลาป่วย ('ป') หรือลากิจ ('ล')
        if (periods.some(st => st === 'ป')) {
            return 'ป';
        }
        if (periods.some(st => st === 'ล')) {
            return 'ล';
        }

        return '/';
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

    ws.getCell('C3').value = 'สถิติการขาดเรียนของนักศึกษา';
    ws.getCell('C3').font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF111827' } };

    ws.getCell('C4').value = `ปีการศึกษา ${info.term}/${yearThai}`;
    ws.getCell('C4').font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FF334155' } };

    // Website link at top right
    const linkColIdx = 6 + weekdays.length + 1;
    const linkColLetter = ws.getColumn(linkColIdx).letter;
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

    const monthLabelCol = ws.getColumn(6 + weekdays.length - 2).letter;
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
    hmCell.value = 'โฮมรูม';
    hmCell.alignment = { textRotation: 90, horizontal: 'center', vertical: 'middle' };

    // Days Header (Row 6)
    const dateStartCol = 6;
    const dateEndCol = dateStartCol + weekdays.length - 1;
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

    // Absence Summary Headers
    const absStartCol = dateEndCol + 1;
    ws.mergeCells(6, absStartCol, 6, absStartCol + 2);
    const absHdr = ws.getCell(6, absStartCol);
    absHdr.value = 'จำนวนที่ขาด';
    absHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    const absSub = ['ขาด', 'ลา', 'รวม'];
    absSub.forEach((sh, idx) => {
        const c = ws.getCell(7, absStartCol + idx);
        c.value = sh;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.font = { name: 'Sarabun', size: 9, bold: true };
        c.fill = headerFill;
    });

    // Note Header
    const noteCol = absStartCol + 3;
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
    hmCell.alignment = { textRotation: 90, horizontal: 'center', vertical: 'middle' };

    dtHdr.fill = headerFill;
    dtHdr.font = { name: 'Sarabun', size: 10, bold: true };
    absHdr.fill = headerFill;
    absHdr.font = { name: 'Sarabun', size: 10, bold: true };
    noteHdr.fill = headerFill;
    noteHdr.font = { name: 'Sarabun', size: 9.5, bold: true };

    // ==========================================
    // 4. ROWS 8..N: STUDENT DATA ROWS
    // ==========================================
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

        let absentCount = 0;
        let leaveCount = 0;

        weekdays.forEach((w, idx) => {
            const cell = r.getCell(dateStartCol + idx);
            const st = getStudentDayStatus(sId, w.dateStr);
            let displayChar = '';

            if (st === 'ข') {
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

        // Summary columns: ขาด, ลา, รวม
        r.getCell(absStartCol).value = absentCount;
        r.getCell(absStartCol + 1).value = leaveCount;
        r.getCell(absStartCol + 2).value = absentCount + leaveCount;

        for (let i = 0; i < 3; i++) {
            const c = r.getCell(absStartCol + i);
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            c.font = { name: 'Sarabun', size: 9.5 };
            if (i === 0 && absentCount > 0) {
                c.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFFF0000' } };
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
    ws.getColumn(absStartCol).width = 6.5;     // ขาด
    ws.getColumn(absStartCol + 1).width = 6.5; // ลา
    ws.getColumn(absStartCol + 2).width = 6.5; // รวม
    ws.getColumn(noteCol).width = 12;          // หมายเหตุ

    return ws;
}

module.exports = {
    buildStudentAffairsMonthlyWorksheet,
    getWeekdaysInMonth,
    THAI_MONTHS_FULL
};
