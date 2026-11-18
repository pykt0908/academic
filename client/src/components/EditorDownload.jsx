import React, { useState, useEffect, useMemo } from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button as MuiButton,
  CircularProgress,
  Alert,
  Paper,
  Box,
  Typography,
  ThemeProvider,
  createTheme,
  Tabs,
  Tab
} from '@mui/material'
import {
  FileSpreadsheet,
  Download,
  ArrowLeft,
  Eye,
  Printer,
  RefreshCw,
  Clock,
  UserX,
  FileCheck
} from 'lucide-react'

const muiTheme = createTheme({
  typography: {
    fontFamily: `'Sarabun', 'TH Sarabun New', sans-serif`,
    button: { textTransform: 'none', fontWeight: 700 }
  },
  palette: {
    primary: {
      main: '#059669',
      dark: '#047857'
    }
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          backgroundColor: '#f8fafc',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94a3b8'
          },
          '&.Mui-focused': {
            backgroundColor: '#ffffff'
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: `'Sarabun', 'TH Sarabun New', sans-serif`,
          fontWeight: 600,
          color: '#475569'
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: `'Sarabun', 'TH Sarabun New', sans-serif`,
          fontWeight: 500
        }
      }
    }
  }
})

const THAI_MONTH_OPTIONS = [
  { value: 'all', label: 'ทุกเดือน (ตลอดภาคเรียน)' },
  { value: '1', label: 'มกราคม' },
  { value: '2', label: 'กุมภาพันธ์' },
  { value: '3', label: 'มีนาคม' },
  { value: '4', label: 'เมษายน' },
  { value: '5', label: 'พฤษภาคม' },
  { value: '6', label: 'มิถุนายน' },
  { value: '7', label: 'กรกฎาคม' },
  { value: '8', label: 'สิงหาคม' },
  { value: '9', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' }
]

const ROUND_OPTIONS = [
  { value: 'all', label: 'ทุกรอบ (เช้า / บ่าย)' },
  { value: '1', label: 'รอบเช้า' },
  { value: '6', label: 'รอบบ่าย' }
]

export default function EditorDownload({ onNavigateHome }) {
  const [reportType, setReportType] = useState('absence') // 'absence' or 'tardy'
  const [term, setTerm] = useState('2')
  const [year, setYear] = useState('2569')
  const [selectedMonth, setSelectedMonth] = useState('11') // Default to current semester month
  const [selectedRound, setSelectedRound] = useState('all') // 'all', '1', '6'
  const [selectedLevel, setSelectedLevel] = useState('all') // 'all', 'ปวช.', 'ปวส.'
  const [selectedClass, setSelectedClass] = useState('all') // 'all' or classNo
  const [termsList, setTermsList] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Preview States
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [activeClassNo, setActiveClassNo] = useState('')
  const [activeMonthIdx, setActiveMonthIdx] = useState(0)

  // Fetch available terms
  useEffect(() => {
    fetch('/api/terms')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTermsList(data)
        }
      })
      .catch(() => {
        setTermsList([
          { Year: '2569', Term: '2' },
          { Year: '2569', Term: '1' },
          { Year: '2568', Term: '2' },
          { Year: '2568', Term: '1' }
        ])
      })
  }, [])

  // Fetch classrooms for selected term/year
  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/editor-download/classes?term=${term}&year=${year}`)
      .then(res => {
        if (!res.ok) throw new Error('ไม่สามารถโหลดรายชื่อห้องเรียนได้')
        return res.json()
      })
      .then(data => {
        setClasses(data.classes || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [term, year])

  // Filtered class list by level and round
  const filteredClassList = useMemo(() => {
    return classes.filter(c => {
      // Level filter
      const matchLevel = selectedLevel === 'all' ||
        (selectedLevel === 'ปวช.' && (c.ClassNo?.startsWith('1') || c.LavelName?.includes('ปวช'))) ||
        (selectedLevel === 'ปวส.' && (!c.ClassNo?.startsWith('1') || c.LavelName?.includes('ปวส')))

      // Round filter (รอบเช้า '1' รวมทวิภาคี '7' ด้วย)
      const cRound = c.ClassNo?.substring(3, 4)
      const matchRound = selectedRound === 'all' ||
        (selectedRound === '1' ? (cRound === '1' || cRound === '7') : cRound === selectedRound)

      return matchLevel && matchRound
    })
  }, [classes, selectedLevel, selectedRound])

  // Reset selectedClass to 'all' if selectedClass is not in the filtered list
  useEffect(() => {
    if (selectedClass !== 'all' && !filteredClassList.some(c => c.ClassNo === selectedClass)) {
      setSelectedClass('all')
    }
  }, [filteredClassList, selectedClass])

  // Available Years
  const availableYears = useMemo(() => {
    const list = Array.from(new Set(termsList.map(t => String(t.Year || t.year)))).filter(Boolean)
    if (!list.includes('2569')) list.push('2569')
    if (!list.includes('2568')) list.push('2568')
    return list.sort((a, b) => b.localeCompare(a))
  }, [termsList])

  // Fetch Preview Function
  const fetchPreview = (targetRoom = activeClassNo) => {
    setPreviewLoading(true)
    setError('')
    const monthParam = selectedMonth !== 'all' ? `&month=${selectedMonth}` : ''
    const levelParam = selectedLevel !== 'all' ? `&level=${encodeURIComponent(selectedLevel)}` : ''
    const roundParam = selectedRound !== 'all' ? `&round=${encodeURIComponent(selectedRound)}` : ''
    const roomParam = selectedClass !== 'all' ? `&classNo=${encodeURIComponent(selectedClass)}` : '&classNo=all'
    const activeParam = targetRoom ? `&activeClassNo=${encodeURIComponent(targetRoom)}` : ''
    const reportTypeParam = `&reportType=${reportType}`

    fetch(`/api/editor-download/preview?term=${term}&year=${year}${roomParam}${monthParam}${levelParam}${roundParam}${reportTypeParam}${activeParam}`)
      .then(res => {
        if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลตัวอย่างรายงานได้')
        return res.json()
      })
      .then(data => {
        if (data.error) throw new Error(data.error)
        setPreviewData(data)
        if (data.activeClassNo) {
          setActiveClassNo(data.activeClassNo)
        }
        setActiveMonthIdx(0)
      })
      .catch(err => {
        console.error(err)
        setError('เกิดข้อผิดพลาดในการโหลดตัวอย่าง: ' + err.message)
      })
      .finally(() => setPreviewLoading(false))
  }

  // Auto-fetch preview on filter change
  useEffect(() => {
    fetchPreview()
  }, [reportType, term, year, selectedMonth, selectedRound, selectedLevel, selectedClass])

  // Handle switching room tab in preview
  const handleSelectRoomTab = (roomNo) => {
    setActiveClassNo(roomNo)
    fetchPreview(roomNo)
  }

  // Active Sheet from Preview Data
  const currentSheet = useMemo(() => {
    if (!previewData?.sheets || previewData.sheets.length === 0) return null
    return previewData.sheets[activeMonthIdx] || previewData.sheets[0]
  }, [previewData, activeMonthIdx])

  // Download Action
  const handleDownload = () => {
    setDownloading(true)
    setError('')
    setSuccessMsg('')

    const monthParam = selectedMonth !== 'all' ? `&month=${selectedMonth}` : ''
    const levelParam = selectedLevel !== 'all' ? `&level=${encodeURIComponent(selectedLevel)}` : ''
    const roundParam = selectedRound !== 'all' ? `&round=${encodeURIComponent(selectedRound)}` : ''
    const reportTypeParam = `&reportType=${reportType}`
    const url = `/api/editor-download/export?term=${term}&year=${year}&classNo=${encodeURIComponent(selectedClass)}${monthParam}${levelParam}${roundParam}${reportTypeParam}`

    const link = document.createElement('a')
    link.href = url
    const monthSuffix = selectedMonth !== 'all' ? `_เดือน${selectedMonth}` : ''
    const targetLabel = selectedClass === 'all' ? 'ทุกห้อง' : selectedClass
    const reportPrefix = reportType === 'tardy' ? 'รายงานการเข้าสาย' : 'สถิติขาดเรียน'
    link.setAttribute('download', `${reportPrefix}_${targetLabel}_${term}_${year}${monthSuffix}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloading(false)
      const mLabel = selectedMonth !== 'all' ? THAI_MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label : 'ตลอดภาคเรียน'
      const rLabel = selectedRound !== 'all' ? ROUND_OPTIONS.find(r => r.value === selectedRound)?.label : ''
      const cLabel = selectedClass === 'all'
        ? `ทุกห้องเรียน (${filteredClassList.length} ห้อง)`
        : (classes.find(c => c.ClassNo === selectedClass)?.ClassName || selectedClass)
      const fullLabel = rLabel ? `${cLabel} (${rLabel})` : cLabel
      const rTypeName = reportType === 'tardy' ? 'รายงานการเข้าสาย' : 'สถิติการขาดเรียน'
      setSuccessMsg(`ดาวน์โหลดไฟล์ Excel ${rTypeName} ของ ${fullLabel} [${mLabel}] เรียบร้อยแล้ว`)
      setTimeout(() => setSuccessMsg(''), 5000)
    }, 1500)
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800" style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/img/logo.png" alt="ตราวิทยาลัย" className="w-9 h-9 object-contain" />
              <div>
                <div className="text-base font-bold text-slate-900 leading-tight">
                  วิทยาลัยเทคโนโลยีศรีราชา
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  ระบบตรวจสอบสถิติเวลาเรียน & ดาวน์โหลดรายงาน Excel
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer rounded-md"
                title="พิมพ์หน้ารายงานนี้"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์</span>
              </button>

              {onNavigateHome && (
                <button
                  onClick={onNavigateHome}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer rounded-md"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>กลับหน้ารายงาน</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
          {/* Top Filter Card */}
          <Paper elevation={0} className="p-5 border border-slate-200 rounded-xl bg-white shadow-xs print:hidden">
            {/* Report Type Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setReportType('absence')}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition ${
                    reportType === 'absence'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <UserX className="w-4 h-4" />
                  <span>1. สถิติการขาดเรียน (รายเดือน)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('tardy')}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border transition ${
                    reportType === 'tardy'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>2. รายงานการเข้าสาย (ดูจากเช็คแถว)</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => fetchPreview()}
                  disabled={previewLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-50"
                  title="รีเฟรชตัวอย่างรายงาน"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                  <span>รีเฟรชตัวอย่าง</span>
                </button>

                <MuiButton
                  variant="contained"
                  size="small"
                  disabled={downloading || loading || (selectedClass === 'all' && filteredClassList.length === 0)}
                  onClick={handleDownload}
                  startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download className="w-4 h-4" />}
                  sx={{
                    bgcolor: '#059669',
                    '&:hover': { bgcolor: '#047857' },
                    py: 1,
                    px: 2.5,
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    borderRadius: 1.5,
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)'
                  }}
                >
                  {downloading ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด Excel (.xlsx)'}
                </MuiButton>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-4">
              {/* Year */}
              <FormControl fullWidth size="small">
                <InputLabel id="year-label">ปีการศึกษา</InputLabel>
                <Select
                  labelId="year-label"
                  value={year}
                  label="ปีการศึกษา"
                  onChange={e => setYear(e.target.value)}
                >
                  {availableYears.map(y => (
                    <MenuItem key={y} value={y}>{y}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Term */}
              <FormControl fullWidth size="small">
                <InputLabel id="term-label">ภาคเรียน</InputLabel>
                <Select
                  labelId="term-label"
                  value={term}
                  label="ภาคเรียน"
                  onChange={e => setTerm(e.target.value)}
                >
                  <MenuItem value="1">ภาคเรียนที่ 1</MenuItem>
                  <MenuItem value="2">ภาคเรียนที่ 2</MenuItem>
                </Select>
              </FormControl>

              {/* Month */}
              <FormControl fullWidth size="small">
                <InputLabel id="month-label">ประจำเดือน</InputLabel>
                <Select
                  labelId="month-label"
                  value={selectedMonth}
                  label="ประจำเดือน"
                  onChange={e => setSelectedMonth(e.target.value)}
                >
                  {THAI_MONTH_OPTIONS.map(m => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Round */}
              <FormControl fullWidth size="small">
                <InputLabel id="round-label">รอบเวลาเรียน</InputLabel>
                <Select
                  labelId="round-label"
                  value={selectedRound}
                  label="รอบเวลาเรียน"
                  onChange={e => setSelectedRound(e.target.value)}
                >
                  {ROUND_OPTIONS.map(r => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Level */}
              <FormControl fullWidth size="small">
                <InputLabel id="level-label">ระดับชั้น</InputLabel>
                <Select
                  labelId="level-label"
                  value={selectedLevel}
                  label="ระดับชั้น"
                  onChange={e => setSelectedLevel(e.target.value)}
                >
                  <MenuItem value="all">ทั้งหมด (ปวช. และ ปวส.)</MenuItem>
                  <MenuItem value="ปวช.">ระดับ ปวช.</MenuItem>
                  <MenuItem value="ปวส.">ระดับ ปวส.</MenuItem>
                </Select>
              </FormControl>

              {/* Classroom */}
              <FormControl fullWidth size="small" disabled={loading}>
                <InputLabel id="classroom-label">ห้องเรียน</InputLabel>
                <Select
                  labelId="classroom-label"
                  value={selectedClass}
                  label="ห้องเรียน"
                  onChange={e => setSelectedClass(e.target.value)}
                >
                  <MenuItem value="all" sx={{ fontWeight: 700, color: '#047857' }}>
                    📁 ทุกห้องเรียน ({filteredClassList.length} ห้อง)
                  </MenuItem>
                  {filteredClassList.map(c => (
                    <MenuItem key={c.ClassNo} value={c.ClassNo}>
                      {c.ClassName || c.ClassNo}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </Paper>

          {/* Success Message */}
          {successMsg && (
            <Alert severity="success" className="rounded-xl border border-emerald-200">
              {successMsg}
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" className="rounded-xl border border-red-200">
              {error}
            </Alert>
          )}

          {/* Preview Container (Exact Excel Form Style) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Sheet Tabs Bar (เหมือนแท็บแผ่นงานด้านล่าง/ด้านบนของ Excel) */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> แผ่นงาน (Sheet):
                </span>

                {/* If user chose "ทุกห้องเรียน" - show room tabs */}
                {selectedClass === 'all' && previewData?.availableRooms?.length > 0 ? (
                  previewData.availableRooms.map(rm => (
                    <button
                      key={rm.ClassNo}
                      onClick={() => handleSelectRoomTab(rm.ClassNo)}
                      className={`px-3 py-1 text-xs font-bold rounded-t-md transition whitespace-nowrap cursor-pointer border-t border-x ${
                        activeClassNo === rm.ClassNo
                          ? 'bg-white text-emerald-800 border-slate-300 shadow-xs border-b-2 border-b-white -mb-[9px] z-10'
                          : 'bg-slate-200/80 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {rm.ClassName || rm.ClassNo}
                    </button>
                  ))
                ) : (
                  <span className="px-3 py-1 text-xs font-bold rounded-t-md bg-white text-emerald-800 border-t border-x border-slate-300 border-b-2 border-b-white -mb-[9px] z-10">
                    {previewData?.activeClassName || activeClassNo || 'ห้องเรียน'}
                  </span>
                )}
              </div>

              {/* Month Subtabs (if multiple months in this room sheet) */}
              {previewData?.sheets?.length > 1 && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-500 mr-1">เดือน:</span>
                  {previewData.sheets.map((sh, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveMonthIdx(idx)}
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded transition ${
                        activeMonthIdx === idx
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {sh.info?.monthName || `เดือน ${sh.info?.monthNum}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Body */}
            {previewLoading ? (
              <div className="py-20 text-center">
                <CircularProgress size={36} className="text-emerald-600" />
                <p className="mt-3 text-sm font-semibold text-slate-600">กำลังประมวลผลตัวอย่างรายงาน Excel...</p>
              </div>
            ) : currentSheet ? (
              <div className="p-6 overflow-x-auto">
                {/* Form Sheet Simulation (A4 Landscape Form Paper) */}
                <div className="min-w-[960px] bg-white text-slate-900 border border-slate-300 p-6 shadow-sm rounded-sm">
                  {/* Top Header Block (Matches rows 1-4 of Excel) */}
                  <div className="flex items-start justify-between pb-4 border-b border-slate-300">
                    <div className="flex items-center gap-4">
                      <img src="/img/logo.png" alt="ตราวิทยาลัย" className="w-14 h-14 object-contain shrink-0" />
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">
                          วิทยาลัยเทคโนโลยีศรีราชา
                        </h2>
                        <h3 className="text-sm font-semibold text-slate-800">
                          งานปกครองนักเรียนนักศึกษา ฝ่ายพัฒนากิจการนักศึกษา
                        </h3>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                          {reportType === 'tardy'
                            ? 'รายงานสถิติการเข้าสายและการขาดเรียนของนักศึกษา'
                            : 'สถิติการขาดเรียนของนักศึกษา'}
                        </h4>
                        <div className="text-xs text-slate-600 font-semibold mt-0.5">
                          ปีการศึกษา {currentSheet.info?.term}/{currentSheet.info?.yearThai}
                        </div>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <a
                        href="https://www.technosriracha.ac.th"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline font-medium"
                      >
                        www.technosriracha.ac.th
                      </a>
                    </div>
                  </div>

                  {/* Subheader: Classroom & Month (Row 5 of Excel) */}
                  <div className="flex items-center justify-between py-2 text-xs font-bold text-slate-800">
                    <div>
                      ระดับชั้น <span className="font-semibold">{currentSheet.info?.levelClass || currentSheet.info?.className}</span> สาขา{' '}
                      <span className="font-semibold">{currentSheet.info?.departName || '-'}</span> รอบ{' '}
                      <span className="font-semibold">{currentSheet.info?.roundName || 'เช้า'}</span>
                    </div>
                    <div>
                      ประจำเดือน <span className="font-semibold">{currentSheet.info?.monthName} {currentSheet.info?.yearThai}</span>
                    </div>
                  </div>

                  {/* Table Grid (Rows 6+ of Excel) */}
                  <div className="border border-black overflow-hidden mt-1">
                    <table className="w-full text-center border-collapse text-[11px]">
                      <thead>
                        {/* Header Row 1 */}
                        <tr className="bg-[#b4c6e7] text-black font-bold">
                          <th rowSpan={2} className="border border-black px-1.5 py-1 w-8">เลขที่</th>
                          <th rowSpan={2} className="border border-black px-2 py-1 w-24">รหัสนักศึกษา</th>
                          <th rowSpan={2} className="border border-black px-2 py-1 text-left min-w-[150px]">ชื่อ-สกุล</th>
                          <th rowSpan={2} className="border border-black px-1 py-1 w-10">เพศ</th>
                          <th rowSpan={2} className="border border-black px-1 py-1 w-8 leading-tight text-[10px]">
                            โ<br/>ฮ<br/>ม<br/>รู<br/>ม
                          </th>
                          <th colSpan={currentSheet.weekdays.length} className="border border-black py-1">
                            วันที่
                          </th>
                          <th
                            colSpan={reportType === 'tardy' ? 4 : 3}
                            className="border border-black py-1"
                          >
                            {reportType === 'tardy' ? 'จำนวนครั้ง' : 'จำนวนที่ขาด'}
                          </th>
                          <th rowSpan={2} className="border border-black px-2 py-1 w-20">หมายเหตุ</th>
                        </tr>

                        {/* Header Row 2: Days & Summary Subheaders */}
                        <tr className="bg-[#b4c6e7] text-black font-bold text-[10px]">
                          {/* Day Numbers */}
                          {currentSheet.weekdays.map(w => (
                            <th key={w.dayNum} className="border border-black py-0.5 px-1 min-w-[20px]">
                              {w.dayNum}
                            </th>
                          ))}

                          {/* Summary Columns */}
                          {reportType === 'tardy' ? (
                            <>
                              <th className="border border-black py-0.5 px-1 w-9 text-amber-900">สาย</th>
                              <th className="border border-black py-0.5 px-1 w-9 text-rose-900">ขาด</th>
                              <th className="border border-black py-0.5 px-1 w-9 text-blue-900">ลา</th>
                              <th className="border border-black py-0.5 px-1 w-9 bg-slate-200">รวม</th>
                            </>
                          ) : (
                            <>
                              <th className="border border-black py-0.5 px-1 w-9 text-rose-900">ขาด</th>
                              <th className="border border-black py-0.5 px-1 w-9 text-blue-900">ลา</th>
                              <th className="border border-black py-0.5 px-1 w-9 bg-slate-200">รวม</th>
                            </>
                          )}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-black font-medium">
                        {currentSheet.students.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6 + currentSheet.weekdays.length + (reportType === 'tardy' ? 4 : 3)}
                              className="py-8 text-center text-slate-400"
                            >
                              ไม่พบข้อมูลนักเรียนในห้องเรียนนี้
                            </td>
                          </tr>
                        ) : (
                          currentSheet.students.map((std) => (
                            <tr key={std.stdNo} className="hover:bg-amber-50/30">
                              <td className="border border-black py-1 px-1 text-center font-bold text-slate-700">
                                {std.no}
                              </td>
                              <td className="border border-black py-1 px-1 font-mono text-center">
                                {std.stdNo}
                              </td>
                              <td className="border border-black py-1 px-2 text-left font-semibold text-slate-900">
                                {std.name}
                              </td>
                              <td className="border border-black py-1 px-1 text-center">
                                {std.gender}
                              </td>
                              <td className="border border-black py-1 px-1 text-center text-slate-300">
                                -
                              </td>

                              {/* Days cells */}
                              {currentSheet.weekdays.map(w => {
                                const st = std.days[w.dayNum] || ''
                                let cellStyle = ''
                                if (st === 'ข') cellStyle = 'text-rose-600 font-black'
                                else if (st === 'ส') cellStyle = 'text-amber-600 font-black'
                                else if (st === 'ล' || st === 'ป') cellStyle = 'text-blue-600 font-black'
                                else if (st === '/') cellStyle = 'text-emerald-800 font-bold'

                                return (
                                  <td key={w.dayNum} className={`border border-black py-1 px-0.5 text-center ${cellStyle}`}>
                                    {st}
                                  </td>
                                )
                              })}

                              {/* Summary cells */}
                              {reportType === 'tardy' && (
                                <td className="border border-black py-1 px-1 text-center font-bold text-amber-600 bg-amber-50/40">
                                  {std.summary.tardy > 0 ? std.summary.tardy : '-'}
                                </td>
                              )}
                              <td className="border border-black py-1 px-1 text-center font-bold text-rose-600 bg-rose-50/40">
                                {std.summary.absent > 0 ? std.summary.absent : '-'}
                              </td>
                              <td className="border border-black py-1 px-1 text-center font-bold text-blue-600 bg-blue-50/40">
                                {std.summary.leave > 0 ? std.summary.leave : '-'}
                              </td>
                              <td className="border border-black py-1 px-1 text-center font-black bg-slate-100 text-slate-900">
                                {std.summary.total > 0 ? std.summary.total : '-'}
                              </td>

                              {/* Note */}
                              <td className="border border-black py-1 px-1 text-center text-[10px] text-slate-400">
                                -
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      {/* Footer Totals Row */}
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t border-black">
                          <td colSpan={5} className="border border-black py-1.5 px-3 text-left">
                            รวม ชาย {currentSheet.totals?.maleCount || 0} คน / หญิง {currentSheet.totals?.femaleCount || 0} คน (รวมทั้งสิ้น {currentSheet.totals?.totalStudents || 0} คน)
                          </td>
                          <td colSpan={currentSheet.weekdays.length} className="border border-black py-1 px-1 text-right pr-2">
                            รวมจำนวน:
                          </td>

                          {reportType === 'tardy' && (
                            <td className="border border-black py-1 px-1 text-center font-black text-amber-700 bg-amber-100/50">
                              {currentSheet.totals?.totalTardy || 0}
                            </td>
                          )}
                          <td className="border border-black py-1 px-1 text-center font-black text-rose-700 bg-rose-100/50">
                            {currentSheet.totals?.totalAbsent || 0}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-black text-blue-700 bg-blue-100/50">
                            {currentSheet.totals?.totalLeave || 0}
                          </td>
                          <td className="border border-black py-1 px-1 text-center font-black text-slate-900 bg-slate-200">
                            {currentSheet.totals?.grandTotal || 0}
                          </td>
                          <td className="border border-black py-1 px-1"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Signatures Block (Matches Excel Footer) */}
                  <div className="grid grid-cols-3 gap-6 pt-10 pb-4 text-center text-xs text-slate-800 font-medium">
                    <div className="space-y-1">
                      <div className="pt-8 border-b border-dotted border-slate-600 mx-auto w-48"></div>
                      <div className="pt-1 font-bold">(........................................................)</div>
                      <div className="text-slate-600">ครูที่ปรึกษา</div>
                    </div>
                    <div className="space-y-1">
                      <div className="pt-8 border-b border-dotted border-slate-600 mx-auto w-48"></div>
                      <div className="pt-1 font-bold">(........................................................)</div>
                      <div className="text-slate-600">หัวหน้าแผนกวิชา</div>
                    </div>
                    <div className="space-y-1">
                      <div className="pt-8 border-b border-dotted border-slate-600 mx-auto w-48"></div>
                      <div className="pt-1 font-bold">(........................................................)</div>
                      <div className="text-slate-600">งานปกครองนักเรียนนักศึกษา</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400">
                ไม่มีข้อมูลตัวอย่างสำหรับเงื่อนไขที่เลือก
              </div>
            )}
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}
