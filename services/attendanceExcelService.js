const ExcelJS = require('exceljs');

const THAI_MONTHS_FULL = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Build a detailed Monthly Attendance Worksheet for a single classroom
 */
function buildClassroomWorksheet(wb, classData, sheetName) {
    const { info, students, months, attRecords } = classData;

    // Excel worksheet names must be <= 31 characters and no special chars: \ / ? * [ ] :
    const cleanSheetName = (sheetName || info.className || info.classNo || 'ห้องเรียน')
        .replace(/[:\\/?*\[\]]/g, '_')
        .substring(0, 30);

    const ws = wb.addWorksheet(cleanSheetName);
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 5 }];

    // 1. Title Block
    ws.mergeCells('A1', 'R1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'วิทยาลัยเทคโนโลยีศรีราชา (Technological Sriracha College)';
    titleCell.font = { name: 'Sarabun', size: 15, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

    ws.mergeCells('A2', 'R2');
    const subTitleCell = ws.getCell('A2');
    subTitleCell.value = `รายงานสถิติการมาเรียนและขาดเรียนรายเดือน (แยกตามห้องเรียนแบบละเอียด) • ภาคเรียนที่ ${info.term}/${info.year}`;
    subTitleCell.font = { name: 'Sarabun', size: 11.5, bold: true, color: { argb: 'FF334155' } };
    subTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };

    ws.mergeCells('A3', 'R3');
    const infoCell = ws.getCell('A3');
    infoCell.value = `ห้องเรียน: ${info.className} (รหัส: ${info.classNo}) | จำนวนนักเรียน: ${students.length} คน | ข้อมูล ณ วันที่ ${new Date().toLocaleDateString('th-TH')}`;
    infoCell.font = { name: 'Sarabun', size: 10, italic: true, color: { argb: 'FF64748B' } };
    infoCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // 2. Fixed Headers (Rows 4 & 5)
    ws.mergeCells('A4:A5');
    ws.getCell('A4').value = 'เลขที่';
    ws.mergeCells('B4:B5');
    ws.getCell('B4').value = 'เลขประจำตัว';
    ws.mergeCells('C4:C5');
    ws.getCell('C4').value = 'ชื่อ - นามสกุล';

    ['A4', 'B4', 'C4'].forEach(addr => {
        const c = ws.getCell(addr);
        c.font = { name: 'Sarabun', size: 10, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    let curCol = 4; // Start at Column D

    // 3. Monthly Headers
    months.forEach(m => {
        const startCol = curCol;
        const endCol = curCol + 5;
        ws.mergeCells(4, startCol, 4, endCol);
        const mCell = ws.getCell(4, startCol);
        mCell.value = m.label;
        mCell.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        mCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        mCell.alignment = { horizontal: 'center', vertical: 'middle' };

        const subHeaders = ['มา', 'ขาด', 'ลา', 'ป่วย', 'รวมคาบ', '% มาเรียน'];
        subHeaders.forEach((sh, idx) => {
            const c = ws.getCell(5, startCol + idx);
            c.value = sh;
            c.font = { name: 'Sarabun', size: 9, bold: true };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            if (sh === 'มา') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            else if (sh === 'ขาด') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            else if (sh === 'ลา') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            else if (sh === 'ป่วย') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
            else if (sh === 'รวมคาบ') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            else if (sh === '% มาเรียน') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        });

        m.startCol = startCol;
        curCol += 6;
    });

    // 4. Grand Total Semester Headers
    const totStartCol = curCol;
    const totEndCol = curCol + 5;
    ws.mergeCells(4, totStartCol, 4, totEndCol);
    const totCell = ws.getCell(4, totStartCol);
    totCell.value = 'สรุปรวมตลอดภาคเรียน';
    totCell.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    totCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    totCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const totSubHeaders = ['รวมมา', 'รวมขาด', 'รวมลา', 'รวมป่วย', 'รวมทั้งหมด', '% สุทธิ'];
    totSubHeaders.forEach((sh, idx) => {
        const c = ws.getCell(5, totStartCol + idx);
        c.value = sh;
        c.font = { name: 'Sarabun', size: 9, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    });

    // 5. Populate Student Data
    let curRow = 6;
    students.forEach(std => {
        const r = ws.getRow(curRow);
        r.getCell(1).value = std.no;
        r.getCell(2).value = std.stdNo;
        r.getCell(3).value = std.name;

        r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

        months.forEach(m => {
            const ms = std.months.get(m.mKey) || { present: 0, absent: 0, leave: 0, sick: 0, total: 0 };
            const pct = ms.total > 0 ? (ms.present / ms.total) : 1.0;

            r.getCell(m.startCol).value = ms.present;
            r.getCell(m.startCol + 1).value = ms.absent;
            r.getCell(m.startCol + 2).value = ms.leave;
            r.getCell(m.startCol + 3).value = ms.sick;
            r.getCell(m.startCol + 4).value = ms.total;

            const pctCell = r.getCell(m.startCol + 5);
            pctCell.value = pct;
            pctCell.numFmt = '0.0%';

            for (let i = 0; i < 6; i++) {
                r.getCell(m.startCol + i).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (ms.absent > 0) {
                r.getCell(m.startCol + 1).font = { name: 'Sarabun', size: 9.5, color: { argb: 'FFDC2626' }, bold: true };
            }
        });

        const grandPct = std.totalPeriods > 0 ? (std.totalPresent / std.totalPeriods) : 1.0;
        r.getCell(totStartCol).value = std.totalPresent;
        r.getCell(totStartCol + 1).value = std.totalAbsent;
        r.getCell(totStartCol + 2).value = std.totalLeave;
        r.getCell(totStartCol + 3).value = std.totalSick;
        r.getCell(totStartCol + 4).value = std.totalPeriods;

        const totPctCell = r.getCell(totStartCol + 5);
        totPctCell.value = grandPct;
        totPctCell.numFmt = '0.0%';
        totPctCell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: grandPct < 0.8 ? 'FFDC2626' : 'FF1D4ED8' } };

        for (let i = 0; i < 6; i++) {
            r.getCell(totStartCol + i).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (std.totalAbsent > 0) {
            r.getCell(totStartCol + 1).font = { name: 'Sarabun', size: 9.5, color: { argb: 'FFDC2626' }, bold: true };
        }

        curRow++;
    });

    // 6. Bottom Classroom Summary Row
    if (students.length > 0) {
        const sumRow = ws.getRow(curRow);
        ws.mergeCells(curRow, 1, curRow, 3);
        sumRow.getCell(1).value = `รวมสถิติทั้งห้องเรียน (${students.length} คน)`;
        sumRow.getCell(1).font = { name: 'Sarabun', size: 10, bold: true };
        sumRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sumRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        months.forEach(m => {
            const colP = ws.getColumn(m.startCol).letter;
            const colA = ws.getColumn(m.startCol + 1).letter;
            const colL = ws.getColumn(m.startCol + 2).letter;
            const colS = ws.getColumn(m.startCol + 3).letter;
            const colT = ws.getColumn(m.startCol + 4).letter;

            sumRow.getCell(m.startCol).value = { formula: `SUM(${colP}6:${colP}${curRow - 1})` };
            sumRow.getCell(m.startCol + 1).value = { formula: `SUM(${colA}6:${colA}${curRow - 1})` };
            sumRow.getCell(m.startCol + 2).value = { formula: `SUM(${colL}6:${colL}${curRow - 1})` };
            sumRow.getCell(m.startCol + 3).value = { formula: `SUM(${colS}6:${colS}${curRow - 1})` };
            sumRow.getCell(m.startCol + 4).value = { formula: `SUM(${colT}6:${colT}${curRow - 1})` };

            sumRow.getCell(m.startCol + 5).value = { formula: `IF(${colT}${curRow}>0, ${colP}${curRow}/${colT}${curRow}, 1)` };
            sumRow.getCell(m.startCol + 5).numFmt = '0.0%';

            for (let i = 0; i < 6; i++) {
                const c = sumRow.getCell(m.startCol + i);
                c.font = { name: 'Sarabun', size: 9.5, bold: true };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            }
        });

        const colTP = ws.getColumn(totStartCol).letter;
        const colTA = ws.getColumn(totStartCol + 1).letter;
        const colTL = ws.getColumn(totStartCol + 2).letter;
        const colTS = ws.getColumn(totStartCol + 3).letter;
        const colTT = ws.getColumn(totStartCol + 4).letter;

        sumRow.getCell(totStartCol).value = { formula: `SUM(${colTP}6:${colTP}${curRow - 1})` };
        sumRow.getCell(totStartCol + 1).value = { formula: `SUM(${colTA}6:${colTA}${curRow - 1})` };
        sumRow.getCell(totStartCol + 2).value = { formula: `SUM(${colTL}6:${colTL}${curRow - 1})` };
        sumRow.getCell(totStartCol + 3).value = { formula: `SUM(${colTS}6:${colTS}${curRow - 1})` };
        sumRow.getCell(totStartCol + 4).value = { formula: `SUM(${colTT}6:${colTT}${curRow - 1})` };
        sumRow.getCell(totStartCol + 5).value = { formula: `IF(${colTT}${curRow}>0, ${colTP}${curRow}/${colTT}${curRow}, 1)` };
        sumRow.getCell(totStartCol + 5).numFmt = '0.0%';

        for (let i = 0; i < 6; i++) {
            const c = sumRow.getCell(totStartCol + i);
            c.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        }
    }

    // 7. Borders for all table cells
    const totalColsCount = totEndCol;
    for (let rIdx = 4; rIdx <= curRow; rIdx++) {
        const row = ws.getRow(rIdx);
        for (let cIdx = 1; cIdx <= totalColsCount; cIdx++) {
            const cell = row.getCell(cIdx);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
            if (!cell.font) {
                cell.font = { name: 'Sarabun', size: 9.5 };
            }
        }
    }

    // 8. Column Widths
    ws.getColumn(1).width = 7;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 28;
    for (let c = 4; c <= totalColsCount; c++) {
        ws.getColumn(c).width = 9.5;
    }

    return ws;
}

/**
 * Build a Daily Attendance Worksheet (all checked dates & periods with ม, ข, ล, ป)
 */
function buildDailyWorksheet(wb, classData) {
    const { info, students, attRecords } = classData;
    if (!attRecords || attRecords.length === 0) return;

    const ws = wb.addWorksheet('บันทึกเวลาเรียนรายวัน');
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 5 }];

    // Unique Sessions sorted by Date and TimeNo
    const sessionMap = new Map();
    attRecords.forEach(r => {
        const key = `${r.DateStr}|${r.TimeNo}`;
        if (!sessionMap.has(key)) {
            sessionMap.set(key, {
                key,
                dateStr: r.DateStr,
                timeNo: r.TimeNo,
                monthNum: r.MonthNum,
                yearNum: r.YearNum
            });
        }
    });

    const sessions = Array.from(sessionMap.values()).sort((a, b) => {
        if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
        return a.timeNo - b.timeNo;
    });

    // Student Status Map: `${stdNo}|${dateStr}|${timeNo}` -> status
    const stdStatusMap = new Map();
    attRecords.forEach(r => {
        stdStatusMap.set(`${String(r.StdNo).trim()}|${r.DateStr}|${r.TimeNo}`, r.Status || 'ม');
    });

    // Title
    ws.mergeCells('A1', 'R1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'วิทยาลัยเทคโนโลยีศรีราชา - บันทึกเวลาเรียนรายวัน/คาบอย่างละเอียด';
    titleCell.font = { name: 'Sarabun', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

    ws.mergeCells('A2', 'R2');
    const subCell = ws.getCell('A2');
    subCell.value = `ห้องเรียน: ${info.className} • ภาคเรียนที่ ${info.term}/${info.year} • ทั้งหมด ${sessions.length} คาบที่เช็คชื่อ`;
    subCell.font = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF334155' } };

    // Headers Row 4 (Dates) & Row 5 (Periods)
    ws.mergeCells('A4:A5');
    ws.getCell('A4').value = 'เลขที่';
    ws.mergeCells('B4:B5');
    ws.getCell('B4').value = 'เลขประจำตัว';
    ws.mergeCells('C4:C5');
    ws.getCell('C4').value = 'ชื่อ - นามสกุล';

    ['A4', 'B4', 'C4'].forEach(addr => {
        const c = ws.getCell(addr);
        c.font = { name: 'Sarabun', size: 10, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });

    // Group sessions by DateStr for Row 4 header
    const dateGroups = [];
    sessions.forEach(s => {
        let dg = dateGroups.find(d => d.dateStr === s.dateStr);
        if (!dg) {
            dg = { dateStr: s.dateStr, colspan: 0 };
            dateGroups.push(dg);
        }
        dg.colspan++;
    });

    let colIdx = 4;
    dateGroups.forEach(dg => {
        const endCol = colIdx + dg.colspan - 1;
        if (dg.colspan > 1) {
            ws.mergeCells(4, colIdx, 4, endCol);
        }
        const cell = ws.getCell(4, colIdx);
        // Format Thai short date: e.g. 13 พ.ย. 69
        const parts = dg.dateStr.split('-');
        const d = parts[2];
        const m = THAI_MONTHS_FULL[parseInt(parts[1])];
        const y = parseInt(parts[0]) > 2500 ? parseInt(parts[0]) : parseInt(parts[0]) + 543;
        cell.value = `${parseInt(d)} ${m} ${y}`;
        cell.font = { name: 'Sarabun', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        colIdx += dg.colspan;
    });

    // Row 5: Period Numbers (TimeNo)
    sessions.forEach((s, idx) => {
        const c = ws.getCell(5, 4 + idx);
        c.value = `คาบ ${s.timeNo}`;
        c.font = { name: 'Sarabun', size: 8.5, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });

    // Summary columns at the right edge
    const sumStartCol = 4 + sessions.length;
    ws.mergeCells(4, sumStartCol, 4, sumStartCol + 4);
    const sumHdr = ws.getCell(4, sumStartCol);
    sumHdr.value = 'สรุปผล';
    sumHdr.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    sumHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sumHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    ['มา', 'ขาด', 'ลา', 'ป่วย', '%'].forEach((sh, idx) => {
        const c = ws.getCell(5, sumStartCol + idx);
        c.value = sh;
        c.font = { name: 'Sarabun', size: 9, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    });

    // Populate Student Rows
    let rIdx = 6;
    students.forEach(std => {
        const r = ws.getRow(rIdx);
        r.getCell(1).value = std.no;
        r.getCell(2).value = std.stdNo;
        r.getCell(3).value = std.name;

        r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

        let pCount = 0, aCount = 0, lCount = 0, sCount = 0;

        sessions.forEach((s, sIdx) => {
            const cell = r.getCell(4 + sIdx);
            const status = stdStatusMap.get(`${std.stdNo}|${s.dateStr}|${s.timeNo}`) || '';
            let displayChar = '';

            if (status === 'ข') {
                displayChar = 'ข';
                aCount++;
                cell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            } else if (status === 'ล') {
                displayChar = 'ล';
                lCount++;
                cell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFD97706' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            } else if (status === 'ป') {
                displayChar = 'ป';
                sCount++;
                cell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: 'FFEA580C' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
            } else if (status === 'ม' || status === '/') {
                displayChar = '/';
                pCount++;
                cell.font = { name: 'Sarabun', size: 9.5, color: { argb: 'FF16A34A' } };
            } else if (status) {
                displayChar = '/';
                pCount++;
            }

            cell.value = displayChar;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Summary columns
        r.getCell(sumStartCol).value = pCount;
        r.getCell(sumStartCol + 1).value = aCount;
        r.getCell(sumStartCol + 2).value = lCount;
        r.getCell(sumStartCol + 3).value = sCount;

        const totalChecked = pCount + aCount + lCount + sCount;
        const pct = totalChecked > 0 ? (pCount / totalChecked) : 1.0;
        const pctCell = r.getCell(sumStartCol + 4);
        pctCell.value = pct;
        pctCell.numFmt = '0.0%';
        pctCell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: pct < 0.8 ? 'FFDC2626' : 'FF1D4ED8' } };

        for (let i = 0; i < 5; i++) {
            r.getCell(sumStartCol + i).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        if (aCount > 0) {
            r.getCell(sumStartCol + 1).font = { name: 'Sarabun', size: 9.5, color: { argb: 'FFDC2626' }, bold: true };
        }

        rIdx++;
    });

    // Borders
    const totalDailyCols = sumStartCol + 4;
    for (let rowI = 4; rowI < rIdx; rowI++) {
        const row = ws.getRow(rowI);
        for (let colI = 1; colI <= totalDailyCols; colI++) {
            row.getCell(colI).border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        }
    }

    ws.getColumn(1).width = 7;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 28;
    for (let c = 4; c < sumStartCol; c++) {
        ws.getColumn(c).width = 7;
    }
    for (let c = sumStartCol; c <= totalDailyCols; c++) {
        ws.getColumn(c).width = 8;
    }
}

/**
 * Build Master Overview Sheet for All-Rooms Export
 */
function buildMasterOverviewSheet(wb, allClassStats, term, year) {
    const ws = wb.addWorksheet('ภาพรวมทุกห้องเรียน');
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

    // Title
    ws.mergeCells('A1:J1');
    const tCell = ws.getCell('A1');
    tCell.value = 'วิทยาลัยเทคโนโลยีศรีราชา (Technological Sriracha College)';
    tCell.font = { name: 'Sarabun', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };

    ws.mergeCells('A2:J2');
    const stCell = ws.getCell('A2');
    stCell.value = `ภาพรวมสถิติการมาเรียนและขาดเรียนรายเดือน (ทุกห้องเรียน) • ภาคเรียนที่ ${term}/${year}`;
    stCell.font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FF334155' } };

    // Headers
    const headers = [
        'ลำดับ', 'รหัสห้อง', 'ชื่อห้องเรียน', 'ระดับชั้น', 'สาขาวิชา',
        'จำนวนนักเรียน (คน)', 'คาบที่เช็คทั้งหมด (คาบ)', 'รวมมา (คาบ)', 'รวมขาด (คาบ)',
        'รวมลา/ป่วย (คาบ)', '% มาเรียนเฉลี่ย'
    ];

    const hRow = ws.getRow(4);
    headers.forEach((h, idx) => {
        const c = hRow.getCell(idx + 1);
        c.value = h;
        c.font = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });

    let rIdx = 5;
    allClassStats.forEach((c, idx) => {
        const r = ws.getRow(rIdx);
        r.getCell(1).value = idx + 1;
        r.getCell(2).value = c.classNo;
        r.getCell(3).value = c.className;
        r.getCell(4).value = c.lavelName || '';
        r.getCell(5).value = c.departName || '';
        r.getCell(6).value = c.studentCount;
        r.getCell(7).value = c.totalPeriods;
        r.getCell(8).value = c.totalPresent;
        r.getCell(9).value = c.totalAbsent;
        r.getCell(10).value = c.totalLeave + c.totalSick;

        const pct = c.totalPeriods > 0 ? (c.totalPresent / c.totalPeriods) : 1.0;
        const pctCell = r.getCell(11);
        pctCell.value = pct;
        pctCell.numFmt = '0.0%';
        pctCell.font = { name: 'Sarabun', size: 9.5, bold: true, color: { argb: pct < 0.8 ? 'FFDC2626' : 'FF1D4ED8' } };

        r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
        for (let i = 6; i <= 11; i++) {
            r.getCell(i).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        for (let i = 1; i <= 11; i++) {
            r.getCell(i).border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
        }

        rIdx++;
    });

    // Total College Row
    if (allClassStats.length > 0) {
        const sumRow = ws.getRow(rIdx);
        ws.mergeCells(rIdx, 1, rIdx, 5);
        sumRow.getCell(1).value = `รวมทั้งหมด (${allClassStats.length} ห้องเรียน)`;
        sumRow.getCell(1).font = { name: 'Sarabun', size: 10, bold: true };
        sumRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sumRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

        sumRow.getCell(6).value = { formula: `SUM(F5:F${rIdx - 1})` };
        sumRow.getCell(7).value = { formula: `SUM(G5:G${rIdx - 1})` };
        sumRow.getCell(8).value = { formula: `SUM(H5:H${rIdx - 1})` };
        sumRow.getCell(9).value = { formula: `SUM(I5:I${rIdx - 1})` };
        sumRow.getCell(10).value = { formula: `SUM(J5:J${rIdx - 1})` };
        sumRow.getCell(11).value = { formula: `IF(G${rIdx}>0, H${rIdx}/G${rIdx}, 1)` };
        sumRow.getCell(11).numFmt = '0.0%';

        for (let i = 1; i <= 11; i++) {
            const cell = sumRow.getCell(i);
            cell.font = { name: 'Sarabun', size: 10, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
            if (i >= 6) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
    }

    ws.getColumn(1).width = 7;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 28;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 24;
    ws.getColumn(6).width = 16;
    ws.getColumn(7).width = 18;
    ws.getColumn(8).width = 14;
    ws.getColumn(9).width = 14;
    ws.getColumn(10).width = 16;
    ws.getColumn(11).width = 16;
}

module.exports = {
    buildClassroomWorksheet,
    buildDailyWorksheet,
    buildMasterOverviewSheet
};
