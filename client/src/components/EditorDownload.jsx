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
  createTheme
} from '@mui/material'
import {
  FileSpreadsheet,
  Download,
  ArrowLeft
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
          fontSize: '0.92rem'
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
  { value: 'all', label: 'ทุกรอบ (เช้า / บ่าย / ทวิภาคี)' },
  { value: '1', label: 'รอบเช้า' },
  { value: '6', label: 'รอบบ่าย' },
  { value: '7', label: 'รอบทวิภาคี' },
  { value: '2', label: 'รอบค่ำ' }
]

export default function EditorDownload({ onNavigateHome }) {
  const [term, setTerm] = useState('2')
  const [year, setYear] = useState('2569')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedRound, setSelectedRound] = useState('all') // 'all', '1', '6', '7', '2'
  const [selectedLevel, setSelectedLevel] = useState('all') // 'all', 'ปวช.', 'ปวส.'
  const [selectedClass, setSelectedClass] = useState('all') // 'all' or classNo
  const [termsList, setTermsList] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

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

      // Round filter
      const cRound = c.ClassNo?.substring(3, 4)
      const matchRound = selectedRound === 'all' || cRound === selectedRound

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

  // Download Action
  const handleDownload = () => {
    setDownloading(true)
    setError('')
    setSuccessMsg('')

    const monthParam = selectedMonth !== 'all' ? `&month=${selectedMonth}` : ''
    const levelParam = selectedLevel !== 'all' ? `&level=${encodeURIComponent(selectedLevel)}` : ''
    const roundParam = selectedRound !== 'all' ? `&round=${encodeURIComponent(selectedRound)}` : ''
    const url = `/api/editor-download/export?term=${term}&year=${year}&classNo=${encodeURIComponent(selectedClass)}${monthParam}${levelParam}${roundParam}`

    const link = document.createElement('a')
    link.href = url
    const monthSuffix = selectedMonth !== 'all' ? `_เดือน${selectedMonth}` : ''
    const targetLabel = selectedClass === 'all' ? 'ทุกห้อง' : selectedClass
    link.setAttribute('download', `สถิติขาดเรียน_${targetLabel}_${term}_${year}${monthSuffix}.xlsx`)
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
      setSuccessMsg(`ดาวน์โหลดไฟล์ Excel ของ ${fullLabel} [${mLabel}] เรียบร้อยแล้ว`)
      setTimeout(() => setSuccessMsg(''), 5000)
    }, 1500)
  }

  // Label for active month
  const activeMonthLabel = selectedMonth !== 'all'
    ? (THAI_MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || selectedMonth)
    : 'ตลอดภาคเรียน'

  // Label for active round
  const activeRoundLabel = selectedRound !== 'all'
    ? (ROUND_OPTIONS.find(r => r.value === selectedRound)?.label || selectedRound)
    : 'ทุกรอบ'

  // Label for active target
  const activeTargetLabel = selectedClass === 'all'
    ? `ทุกห้องเรียน (${filteredClassList.length} ห้อง)`
    : (classes.find(c => c.ClassNo === selectedClass)?.ClassName || selectedClass)

  return (
    <ThemeProvider theme={muiTheme}>
      <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800" style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/img/logo.png" alt="ตราวิทยาลัย" className="w-9 h-9 object-contain" />
              <div>
                <div className="text-base font-bold text-slate-900 leading-tight">
                  วิทยาลัยเทคโนโลยีศรีราชา
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  ระบบดาวน์โหลดสถิติเวลาเรียน (Excel)
                </div>
              </div>
            </div>

            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>กลับหน้ารายงาน</span>
            </button>
          </div>
        </header>

        {/* Main Centered Content */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
          {/* Success Alert */}
          {successMsg && (
            <Alert severity="success" sx={{ mb: 3, fontWeight: 600 }}>
              {successMsg}
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, fontWeight: 600 }}>
              {error}
            </Alert>
          )}

          {/* Material Paper Card */}
          <Paper
            elevation={2}
            sx={{
              p: { xs: 3, sm: 4.5 },
              borderRadius: 2,
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff'
            }}
          >
            {/* Card Title */}
            <Box sx={{ borderBottom: '1px solid #e2e8f0', pb: 2.5, mb: 3.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#059669', mb: 0.5 }}>
                <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  ส่งออกสถิติการขาดเรียน (Excel)
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                แบบฟอร์มสถิติการขาดเรียนของนักศึกษา (งานปกครองนักเรียนนักศึกษา ฝ่ายพัฒนากิจการนักศึกษา)
              </Typography>
            </Box>

            {/* Form Controls with Material Style */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Row 1: Term & Year */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <FormControl fullWidth size="medium">
                  <InputLabel id="term-label">ภาคเรียน</InputLabel>
                  <Select
                    labelId="term-label"
                    id="term-select"
                    value={term}
                    label="ภาคเรียน"
                    onChange={e => setTerm(e.target.value)}
                  >
                    <MenuItem value="1">ภาคเรียนที่ 1</MenuItem>
                    <MenuItem value="2">ภาคเรียนที่ 2</MenuItem>
                    <MenuItem value="3">ภาคเรียนที่ 3 (ฤดูร้อน)</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth size="medium">
                  <InputLabel id="year-label">ปีการศึกษา</InputLabel>
                  <Select
                    labelId="year-label"
                    id="year-select"
                    value={year}
                    label="ปีการศึกษา"
                    onChange={e => setYear(e.target.value)}
                  >
                    {availableYears.map(y => (
                      <MenuItem key={y} value={y}>พ.ศ. {y}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Row 2: Month & Round (เช้า-บ่าย) */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <FormControl fullWidth size="medium">
                  <InputLabel id="month-label">ประจำเดือน</InputLabel>
                  <Select
                    labelId="month-label"
                    id="month-select"
                    value={selectedMonth}
                    label="ประจำเดือน"
                    onChange={e => setSelectedMonth(e.target.value)}
                  >
                    {THAI_MONTH_OPTIONS.map(m => (
                      <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="medium">
                  <InputLabel id="round-label">รอบเวลาเรียน (เช้า - บ่าย)</InputLabel>
                  <Select
                    labelId="round-label"
                    id="round-select"
                    value={selectedRound}
                    label="รอบเวลาเรียน (เช้า - บ่าย)"
                    onChange={e => setSelectedRound(e.target.value)}
                  >
                    {ROUND_OPTIONS.map(r => (
                      <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Row 3: Level */}
              <FormControl fullWidth size="medium">
                <InputLabel id="level-label">ระดับชั้น</InputLabel>
                <Select
                  labelId="level-label"
                  id="level-select"
                  value={selectedLevel}
                  label="ระดับชั้น"
                  onChange={e => setSelectedLevel(e.target.value)}
                >
                  <MenuItem value="all">ทั้งหมด (ปวช. และ ปวส.)</MenuItem>
                  <MenuItem value="ปวช.">ระดับ ปวช.</MenuItem>
                  <MenuItem value="ปวส.">ระดับ ปวส.</MenuItem>
                </Select>
              </FormControl>

              {/* Row 4: Classroom Selector */}
              <FormControl fullWidth size="medium" disabled={loading}>
                <InputLabel id="classroom-label">ห้องเรียนที่ต้องการดาวน์โหลด</InputLabel>
                <Select
                  labelId="classroom-label"
                  id="classroom-select"
                  value={selectedClass}
                  label="ห้องเรียนที่ต้องการดาวน์โหลด"
                  onChange={e => setSelectedClass(e.target.value)}
                >
                  <MenuItem value="all" sx={{ fontWeight: 700, color: '#047857' }}>
                    📁 ทุกห้องเรียน ({filteredClassList.length} ห้อง - รวมในไฟล์เดียว)
                  </MenuItem>
                  {filteredClassList.map(c => (
                    <MenuItem key={c.ClassNo} value={c.ClassNo}>
                      {c.ClassName || c.ClassNo} ({c.StudentCount || 0} คน)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Summary Box */}
              <Box
                sx={{
                  bgcolor: '#f8fafc',
                  p: 2,
                  borderRadius: 1.5,
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 1
                }}
              >
                <Box sx={{ fontSize: '0.85rem', color: '#475569' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>เงื่อนไข: </span>
                  <span>{activeTargetLabel}</span>
                  <span style={{ margin: '0 6px', color: '#94a3b8' }}>•</span>
                  <span>{activeRoundLabel}</span>
                  <span style={{ margin: '0 6px', color: '#94a3b8' }}>•</span>
                  <span>เดือน{activeMonthLabel}</span>
                  <span style={{ margin: '0 6px', color: '#94a3b8' }}>•</span>
                  <span>ภาคเรียนที่ {term}/{year}</span>
                </Box>
                <Box sx={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                  ฟอร์ม A4 แนวนอน
                </Box>
              </Box>

              {/* Download Button */}
              <MuiButton
                variant="contained"
                fullWidth
                size="large"
                disabled={downloading || loading || (selectedClass === 'all' && filteredClassList.length === 0)}
                onClick={handleDownload}
                startIcon={downloading ? <CircularProgress size={20} color="inherit" /> : <Download className="w-5 h-5" />}
                sx={{
                  bgcolor: '#059669',
                  '&:hover': { bgcolor: '#047857' },
                  py: 1.5,
                  fontWeight: 700,
                  fontSize: '1rem',
                  borderRadius: 1.5,
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                }}
              >
                {downloading ? 'กำลังสร้างไฟล์ Excel...' : 'ดาวน์โหลดไฟล์ Excel (.xlsx)'}
              </MuiButton>
            </Box>
          </Paper>
        </main>
      </div>
    </ThemeProvider>
  )
}
