import React, { useState, useEffect, useMemo } from 'react'
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Paper,
  Button,
  Grid,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormLabel
} from '@mui/material'
import PrintIcon from '@mui/icons-material/Print'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import LogoutIcon from '@mui/icons-material/Logout'
import SchoolIcon from '@mui/icons-material/School'
import AssignmentIcon from '@mui/icons-material/Assignment'

// Material UI Theme with Sarabun font, zero border radius, clean corporate palette
const theme = createTheme({
  typography: {
    fontFamily: `'Sarabun', 'TH Sarabun New', sans-serif`,
    h6: { fontWeight: 700, fontSize: '1.25rem' },
    subtitle1: { fontWeight: 700, fontSize: '1.05rem' },
    subtitle2: { fontWeight: 600, fontSize: '0.95rem' },
    body1: { fontSize: '0.95rem' },
    body2: { fontSize: '0.88rem' },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  palette: {
    primary: {
      main: '#1e3a8a',
      light: '#3b82f6',
      dark: '#0f172a',
      contrastText: '#ffffff'
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff'
    },
    divider: '#cbd5e1'
  },
  shape: {
    borderRadius: 0
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundImage: 'none'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '6px 8px',
          borderColor: '#cbd5e1',
          fontFamily: `'Sarabun', 'TH Sarabun New', sans-serif`,
          backgroundColor: '#ffffff'
        }
      }
    }
  }
})

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('teacher_token') || null)
  const [teacher, setTeacher] = useState(null)

  // Login State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Filter State
  const [termsData, setTermsData] = useState([])
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [subjectsData, setSubjectsData] = useState([])
  const [selectedSubNo, setSelectedSubNo] = useState('')
  const [classrooms, setClassrooms] = useState([])
  const [selectedClassNo, setSelectedClassNo] = useState('')

  // Derived: Available Years & Terms
  const availableYears = useMemo(() => {
    const set = new Set(termsData.map(t => String(t.Year)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [termsData])

  const availableTerms = useMemo(() => {
    if (!selectedYear) return []
    const terms = termsData
      .filter(t => String(t.Year) === String(selectedYear))
      .map(t => String(t.Term))
    // Standard Thai vocational academic system has 3 terms: 1, 2, and 3 (ฤดูร้อน)
    const set = new Set([...terms, '1', '2', '3'])
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [termsData, selectedYear])

  // Attendance Matrix State
  const [matrixData, setMatrixData] = useState(null)
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [matrixError, setMatrixError] = useState('')
  const [viewMode, setViewMode] = useState('all') // 'all' (ตลอดภาคเรียน) หรือ 'checked' (เฉพาะคาบที่สอนแล้ว)
  const [customDateBegin, setCustomDateBegin] = useState('')

  const activeColumns = useMemo(() => {
    if (!matrixData) return []
    return (viewMode === 'checked' && matrixData.checkedColumns)
      ? matrixData.checkedColumns
      : (matrixData.columns || [])
  }, [matrixData, viewMode])

  const activeMonthGroups = useMemo(() => {
    if (!matrixData) return []
    return (viewMode === 'checked' && matrixData.checkedMonthGroups)
      ? matrixData.checkedMonthGroups
      : (matrixData.monthGroups || [])
  }, [matrixData, viewMode])

  // Auto-Chunking Print Pages (Calculates balanced 2D chunks: columns for horizontal, students for vertical)
  const printPages = useMemo(() => {
    if (!matrixData || activeColumns.length === 0) return []
    const totalCols = activeColumns.length
    const totalStudents = matrixData.students ? matrixData.students.length : 0
    const MAX_COLS_PER_PAGE = 22
    const MAX_STUDENTS_PER_PAGE = 16

    // 1. Horizontal Slicing (Teaching Periods)
    let colChunks = []
    if (totalCols <= 24) {
      colChunks = [{
        colStart: 0,
        colEnd: totalCols,
        columns: activeColumns,
        monthGroups: activeMonthGroups,
        isLastCol: true
      }]
    } else {
      const numColPages = Math.ceil(totalCols / MAX_COLS_PER_PAGE)
      const colsPerPage = Math.ceil(totalCols / numColPages)
      for (let p = 0; p < numColPages; p++) {
        const start = p * colsPerPage
        const end = Math.min(start + colsPerPage, totalCols)
        const pageCols = activeColumns.slice(start, end)

        // Rebuild month/week/date hierarchy for this column slice
        const pageMonths = []
        for (const col of pageCols) {
          let mg = pageMonths.find(m => m.monthKey === col.monthKey)
          if (!mg) {
            mg = {
              monthKey: col.monthKey,
              monthName: col.monthName,
              yearThai: col.yearThai,
              colspan: 0,
              weekGroups: []
            }
            pageMonths.push(mg)
          }
          mg.colspan++

          let wg = mg.weekGroups.find(w => w.weekNo === col.weekNo)
          if (!wg) {
            wg = {
              weekNo: col.weekNo,
              colspan: 0,
              dateGroups: []
            }
            mg.weekGroups.push(wg)
          }
          wg.colspan++

          let dg = wg.dateGroups.find(d => d.dateStr === col.dateStr)
          if (!dg) {
            dg = {
              dateStr: col.dateStr,
              dateNum: col.dateNum,
              colspan: 0
            }
            wg.dateGroups.push(dg)
          }
          dg.colspan++
        }

        colChunks.push({
          colStart: start,
          colEnd: end,
          columns: pageCols,
          monthGroups: pageMonths,
          isLastCol: (p === numColPages - 1)
        })
      }
    }

    // 2. Vertical Slicing (Students)
    let studentChunks = []
    if (totalStudents <= MAX_STUDENTS_PER_PAGE) {
      studentChunks = [{
        stdStart: 0,
        stdEnd: totalStudents,
        students: matrixData.students,
        isLastRow: true
      }]
    } else {
      const numRowPages = Math.ceil(totalStudents / MAX_STUDENTS_PER_PAGE)
      const studentsPerPage = Math.ceil(totalStudents / numRowPages)
      for (let s = 0; s < numRowPages; s++) {
        const start = s * studentsPerPage
        const end = Math.min(start + studentsPerPage, totalStudents)
        studentChunks.push({
          stdStart: start,
          stdEnd: end,
          students: matrixData.students.slice(start, end),
          isLastRow: (s === numRowPages - 1)
        })
      }
    }

    // 3. Combine into final Print Pages (Col Chunk first, then Student Chunk)
    const totalPages = colChunks.length * studentChunks.length
    const pages = []
    let pageNum = 1

    for (let c = 0; c < colChunks.length; c++) {
      const colChunk = colChunks[c]
      for (let s = 0; s < studentChunks.length; s++) {
        const stdChunk = studentChunks[s]
        const isLastPage = (c === colChunks.length - 1) && (s === studentChunks.length - 1)

        let pageLabel = ''
        if (colChunks.length > 1 && studentChunks.length > 1) {
          pageLabel = `คาบที่ ${colChunk.colStart + 1}-${colChunk.colEnd} • นักเรียนลำดับที่ ${stdChunk.stdStart + 1}-${stdChunk.stdEnd}`
        } else if (colChunks.length > 1) {
          pageLabel = `คาบที่ ${colChunk.colStart + 1}-${colChunk.colEnd}`
        } else if (studentChunks.length > 1) {
          pageLabel = `นักเรียนลำดับที่ ${stdChunk.stdStart + 1}-${stdChunk.stdEnd}`
        }

        pages.push({
          pageIndex: pageNum,
          totalPages,
          pageLabel,
          colStart: colChunk.colStart,
          colEnd: colChunk.colEnd,
          columns: colChunk.columns,
          monthGroups: colChunk.monthGroups,
          isLastCol: colChunk.isLastCol,
          stdStart: stdChunk.stdStart,
          stdEnd: stdChunk.stdEnd,
          students: stdChunk.students,
          isLastRow: stdChunk.isLastRow,
          isLastPage
        })
        pageNum++
      }
    }

    return pages
  }, [matrixData, activeColumns, activeMonthGroups])

  // Teaching Logs State (สมุดบันทึกการสอนประจำวัน / เนื้อหาที่สอน)
  const [teachingLogsData, setTeachingLogsData] = useState(null)
  const [teachingLogsLoading, setTeachingLogsLoading] = useState(false)
  const [teachingLogsError, setTeachingLogsError] = useState('')
  const [printMode, setPrintMode] = useState('attendance') // 'attendance' | 'teaching-log'
  const [teachingLogDialogOpen, setTeachingLogDialogOpen] = useState(false)
  const [printReportMode, setPrintReportMode] = useState('combined') // 'combined' | 'single'
  const [printReportScope, setPrintReportScope] = useState('all') // 'all' | 'recorded'

  // 1. Check Session on Mount
  useEffect(() => {
    if (token) {
      fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Session invalid')
          return res.json()
        })
        .then(data => {
          setTeacher(data)
          loadTerms(token)
        })
        .catch(() => handleLogout())
    }
  }, [token])

  // 2. Load Terms
  const loadTerms = async (authToken) => {
    try {
      const res = await fetch('/api/terms', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()
      setTermsData(data)
      if (data.length > 0) {
        setSelectedYear(String(data[0].Year))
        setSelectedTerm(String(data[0].Term))
      }
    } catch (err) {
      console.error('Failed to load terms:', err)
    }
  }

  // 3. Load Subjects on Year or Term Change
  useEffect(() => {
    if (!token || !selectedYear || !selectedTerm) return

    fetch(`/api/teacher/subjects-classes?term=${selectedTerm}&year=${selectedYear}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setSubjectsData(data)
        setSelectedSubNo('')
        setClassrooms([])
        setSelectedClassNo('')
        setMatrixData(null)
      })
      .catch(err => console.error('Failed to load subjects:', err))
  }, [selectedYear, selectedTerm, token])

  // 4. Update Classrooms on Subject Change
  useEffect(() => {
    if (!selectedSubNo) {
      setClassrooms([])
      setSelectedClassNo('')
      setMatrixData(null)
      return
    }
    const found = subjectsData.find(s => s.subNo === selectedSubNo)
    if (found) {
      setClassrooms(found.classes || [])
      setSelectedClassNo('')
      setMatrixData(null)
    }
  }, [selectedSubNo, subjectsData])

  // 5. Auto-Fetch Matrix Sheet when Classroom is selected
  useEffect(() => {
    if (!token || !selectedYear || !selectedTerm || !selectedSubNo || !selectedClassNo) {
      setMatrixData(null)
      return
    }

    setMatrixLoading(true)
    setMatrixError('')

    let url = `/api/teacher/attendance-sheet?term=${selectedTerm}&year=${selectedYear}&subNo=${encodeURIComponent(selectedSubNo)}&classNo=${encodeURIComponent(selectedClassNo)}`
    if (customDateBegin) {
      url += `&dateBegin=${encodeURIComponent(customDateBegin)}`
    }

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'Failed') })
        return res.json()
      })
      .then(data => {
        setMatrixData(data)
        if (data?.info?.dateBegin && !customDateBegin) {
          setCustomDateBegin(data.info.dateBegin)
        }
      })
      .catch(err => {
        setMatrixError(err.message)
      })
      .finally(() => {
        setMatrixLoading(false)
      })
  }, [selectedClassNo, selectedSubNo, selectedYear, selectedTerm, token, customDateBegin])

  // Login
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ')

      localStorage.setItem('teacher_token', data.token)
      setToken(data.token)
      setTeacher(data)
      loadTerms(data.token)
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  // Logout
  const handleLogout = () => {
    if (token) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => { })
    }
    localStorage.removeItem('teacher_token')
    setToken(null)
    setTeacher(null)
    setMatrixData(null)
    setCustomDateBegin('')
  }

  // Print Handlers
  const handlePrintAttendance = () => {
    let styleEl = document.getElementById('print-orientation-style')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'print-orientation-style'
      document.head.appendChild(styleEl)
    }
    styleEl.innerHTML = '@page { size: A4 landscape; margin: 5mm 6mm; }'

    setPrintMode('attendance')
    setTimeout(() => {
      window.print()
    }, 150)
  }

  // Print Teaching Log (Direct to Print, No Preview, A4 Portrait)
  const handlePrintTeachingLog = async (mode = printReportMode, scope = printReportScope) => {
    if (!selectedYear || !selectedTerm || !selectedSubNo || !selectedClassNo) return
    setTeachingLogsLoading(true)
    setTeachingLogDialogOpen(false)
    try {
      const res = await fetch(
        `/api/teacher/teaching-logs?term=${encodeURIComponent(selectedTerm)}&year=${encodeURIComponent(selectedYear)}&subNo=${encodeURIComponent(selectedSubNo)}&classNo=${encodeURIComponent(selectedClassNo)}&mode=${encodeURIComponent(mode)}&scope=${encodeURIComponent(scope)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP error ${res.status}`)
      }
      const data = await res.json()
      setTeachingLogsData(data)

      if (!data.logs || data.logs.length === 0) {
        alert('ไม่พบบันทึกการสอนที่ตรงกับเงื่อนไขที่เลือก')
        return
      }

      let styleEl = document.getElementById('print-orientation-style')
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'print-orientation-style'
        document.head.appendChild(styleEl)
      }
      styleEl.innerHTML = `
        @page { size: A4 portrait; margin: 10mm 14mm; }
        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `

      setPrintMode('teaching-log')
      setTimeout(() => {
        window.print()
      }, 250)
    } catch (err) {
      console.error('Fetch teaching logs print error:', err)
      alert('ไม่สามารถโหลดข้อมูลบันทึกการสอนได้: ' + err.message)
    } finally {
      setTeachingLogsLoading(false)
    }
  }

  // Render Ruled Notes (Natural flow, fills 100% of the line width, with seamless dotted ruled lines)
  const renderRuledNotes = (content, minLines = 2) => {
    const text = (content && content !== '-') ? content.trim() : ''
    const minHeight = `${minLines * 28}px`

    // Highlight "คาบที่ X:" in bold
    const formatBoldPeriods = (str) => {
      if (!str) return ''
      const lines = str.split('\n')
      return lines.map((line, lIdx) => {
        const match = line.match(/^(คาบที่\s*\d+\s*:?)(.*)$/)
        if (match) {
          return (
            <React.Fragment key={lIdx}>
              <strong style={{ fontWeight: 700, color: '#000' }}>{match[1]}</strong>
              {match[2]}
              {lIdx < lines.length - 1 ? '\n' : ''}
            </React.Fragment>
          )
        }
        return (
          <React.Fragment key={lIdx}>
            {line}
            {lIdx < lines.length - 1 ? '\n' : ''}
          </React.Fragment>
        )
      })
    }

    return (
      <div
        style={{
          width: '100%',
          minHeight,
          lineHeight: '28px',
          fontSize: '10pt',
          paddingLeft: '16px',
          marginBottom: '10px',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='28'%3E%3Crect width='4' height='28' fill='white'/%3E%3Crect x='0' y='27' width='2' height='1' fill='%23444444'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundPosition: '0 0',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        {formatBoldPeriods(text)}
      </div>
    )
  }

  // Excel Export
  const handleExportExcel = () => {
    if (!selectedYear || !selectedTerm || !selectedSubNo || !selectedClassNo) return
    let url = `/api/teacher/attendance-sheet/export-excel?term=${selectedTerm}&year=${selectedYear}&subNo=${encodeURIComponent(selectedSubNo)}&classNo=${encodeURIComponent(selectedClassNo)}&viewMode=${viewMode}`
    if (customDateBegin) {
      url += `&dateBegin=${encodeURIComponent(customDateBegin)}`
    }

    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const linkUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = linkUrl
        a.download = `ตารางเช็คชื่อ_${selectedClassNo}_${selectedSubNo}.xlsx`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(linkUrl)
      })
      .catch(err => alert('เกิดข้อผิดพลาดในการดาวน์โหลด Excel: ' + err.message))
  }

  // ==========================================
  // VIEW 1: LOGIN (Zero Border Radius, Clean)
  // ==========================================
  if (!token) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#f1f5f9',
            p: 2
          }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: 380,
              width: '100%',
              p: 4,
              borderRadius: 0,
              border: '1px solid #cbd5e1',
              textAlign: 'center',
              bgcolor: '#ffffff'
            }}
          >
            <Box
              component="img"
              src="/img/logo.png"
              alt="โลโก้วิทยาลัยเทคโนโลยีศรีราชา"
              sx={{ width: 72, height: 72, objectFit: 'contain', mx: 'auto', mb: 2 }}
            />

            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
              วิทยาลัยเทคโนโลยีศรีราชา
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              สมุดบันทึกเวลาเรียนและการเข้าสอน
            </Typography>

            {loginError && (
              <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem', borderRadius: 0 }}>
                {loginError}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="ชื่อผู้ใช้งาน"
                placeholder="รหัสครูผู้สอน"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              <TextField
                fullWidth
                size="small"
                type="password"
                label="รหัสผ่าน"
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loginLoading}
                sx={{
                  py: 1.2,
                  bgcolor: '#1e3a8a',
                  borderRadius: 0,
                  fontWeight: 600,
                  '&:hover': { bgcolor: '#0f172a' }
                }}
              >
                {loginLoading ? <CircularProgress size={22} color="inherit" /> : 'เข้าสู่ระบบ'}
              </Button>
            </Box>
          </Paper>
        </Box>
      </ThemeProvider>
    )
  }

  // ==========================================
  // VIEW 2: DASHBOARD & TABLE (Clean, Sharp, White Table)
  // ==========================================
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>

        {/* Top AppBar */}
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: '1px solid #cbd5e1', bgcolor: '#ffffff' }}
          className="no-print"
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/img/logo.png"
                alt="โลโก้"
                sx={{ width: 38, height: 38, objectFit: 'contain' }}
              />
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                    วิทยาลัยเทคโนโลยีศรีราชา
                  </Typography>
                  <Chip
                    label="ระบบบันทึกเวลาเรียน"
                    size="small"
                    variant="outlined"
                    sx={{
                      borderRadius: 0,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      height: 20,
                      borderColor: '#cbd5e1'
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  สมุดบันทึกเวลาเรียนและการเข้าสอน
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  {teacher?.TeacherName || teacher?.TeacherNo}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {teacher?.DepartNameFull || teacher?.TeacherNo}
                </Typography>
              </Box>

              <Button
                variant="outlined"
                size="small"
                onClick={handleLogout}
                startIcon={<LogoutIcon fontSize="small" />}
                sx={{
                  borderRadius: 0,
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  '&:hover': { color: '#dc2626', borderColor: '#dc2626' }
                }}
              >
                ออกจากระบบ
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Body */}
        <Container maxWidth="xl" sx={{ py: 2.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }} className="no-print">

          {/* Controls: Material Select Filters */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: '1px solid #cbd5e1',
              borderRadius: 0,
              bgcolor: '#ffffff'
            }}
          >
            <Grid container spacing={2} alignItems="center">
              {/* 1. Academic Year */}
              <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                  1. ปีการศึกษา
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedYear}
                    displayEmpty
                    onChange={(e) => {
                      const newYear = e.target.value
                      setSelectedYear(newYear)
                      const termsForYear = termsData
                        .filter(t => String(t.Year) === String(newYear))
                        .map(t => String(t.Term))
                      if (termsForYear.length > 0 && !termsForYear.includes(selectedTerm)) {
                        setSelectedTerm(termsForYear[0])
                      }
                    }}
                    sx={{ borderRadius: 0 }}
                  >
                    {availableYears.map(y => (
                      <MenuItem key={y} value={y}>
                        ปีการศึกษา {y}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* 2. Semester / Term */}
              <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                  2. ภาคเรียน
                </Typography>
                <FormControl fullWidth size="small" disabled={!selectedYear}>
                  <Select
                    value={selectedTerm}
                    displayEmpty
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    sx={{ borderRadius: 0 }}
                  >
                    {availableTerms.map(t => (
                      <MenuItem key={t} value={t}>
                        ภาคเรียนที่ {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* 3. Subject */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                  3. รายวิชา
                </Typography>
                <FormControl fullWidth size="small" disabled={!selectedYear || !selectedTerm}>
                  <Select
                    value={selectedSubNo}
                    displayEmpty
                    onChange={(e) => setSelectedSubNo(e.target.value)}
                    sx={{ borderRadius: 0 }}
                  >
                    <MenuItem value="">-- เลือกรายวิชา ({subjectsData.length}) --</MenuItem>
                    {subjectsData.map(s => (
                      <MenuItem key={s.subNo} value={s.subNo}>
                        {s.subNo} {s.subjectName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* 4. Classroom */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', mb: 0.5 }}>
                  4. ห้องเรียน
                </Typography>
                <FormControl fullWidth size="small" disabled={!selectedSubNo}>
                  <Select
                    value={selectedClassNo}
                    displayEmpty
                    onChange={(e) => setSelectedClassNo(e.target.value)}
                    renderValue={(selected) => {
                      if (!selected) {
                        return <span style={{ color: '#94a3b8' }}>{selectedSubNo ? `-- เลือกห้องเรียน (${classrooms.length}) --` : '-- โปรดเลือกรายวิชาก่อน --'}</span>
                      }
                      const found = classrooms.find(c => c.classNo === selected)
                      if (found && found.className && found.className !== found.classNo) {
                        return `${found.className} (${found.classNo})`
                      }
                      return selected
                    }}
                    sx={{ borderRadius: 0 }}
                  >
                    <MenuItem value="">
                      {selectedSubNo ? `-- เลือกห้องเรียน (${classrooms.length}) --` : '-- โปรดเลือกรายวิชาก่อน --'}
                    </MenuItem>
                    {classrooms.map(c => (
                      <MenuItem key={c.classNo} value={c.classNo}>
                        {c.className && c.className !== c.classNo ? `${c.className} (${c.classNo})` : c.classNo}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          {/* Table Container Card */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid #cbd5e1',
              borderRadius: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#ffffff'
            }}
          >
            {/* Table Header Action Bar */}
            <Box
              sx={{
                p: 1.8,
                px: 2,
                borderBottom: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                bgcolor: '#ffffff'
              }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  {matrixData
                    ? `${matrixData.info.subNo} ${matrixData.info.subjectName} — ห้อง ${matrixData.info.className && matrixData.info.className !== matrixData.info.classNo ? `${matrixData.info.className} (${matrixData.info.classNo})` : matrixData.info.classNo}`
                    : 'ตารางบันทึกเวลาเรียน'}
                </Typography>

                {matrixData && (
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    ภาคเรียนที่ {matrixData.info.term}/{matrixData.info.year} • นักเรียน {matrixData.info.totalStudents} คน • คาบสอนทั้งหมด {matrixData.info.amountTeachAll} คาบ • เช็คชื่อแล้ว {matrixData.info.totalTaughtSessions} คาบ
                  </Typography>
                )}
              </Box>

              {matrixData && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                  {/* View Mode Toggle Button */}
                  <ButtonGroup size="small" variant="outlined" sx={{ borderRadius: 0 }}>
                    <Button
                      onClick={() => setViewMode('all')}
                      variant={viewMode === 'all' ? 'contained' : 'outlined'}
                      sx={{
                        borderRadius: 0,
                        textTransform: 'none',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        py: 0.6,
                        px: 1.5,
                        bgcolor: viewMode === 'all' ? '#1e3a8a' : 'transparent',
                        color: viewMode === 'all' ? '#fff' : '#334155'
                      }}
                    >
                      ตารางตลอดภาคเรียน ({matrixData.info.totalScheduledPeriods} คาบ)
                    </Button>
                    <Button
                      onClick={() => setViewMode('checked')}
                      variant={viewMode === 'checked' ? 'contained' : 'outlined'}
                      sx={{
                        borderRadius: 0,
                        textTransform: 'none',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        py: 0.6,
                        px: 1.5,
                        bgcolor: viewMode === 'checked' ? '#1e3a8a' : 'transparent',
                        color: viewMode === 'checked' ? '#fff' : '#334155'
                      }}
                    >
                      เฉพาะคาบที่สอนแล้ว ({matrixData.info.totalTaughtSessions} คาบ)
                    </Button>
                  </ButtonGroup>

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handlePrintAttendance}
                    startIcon={<PrintIcon fontSize="small" />}
                    sx={{
                      borderRadius: 0,
                      borderColor: '#cbd5e1',
                      color: '#334155',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      py: 0.6,
                      px: 1.5
                    }}
                  >
                    พิมพ์เวลาเรียน (A4{printPages.length > 1 ? ` • ${printPages.length} หน้า` : ''})
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    disabled={teachingLogsLoading}
                    onClick={() => setTeachingLogDialogOpen(true)}
                    startIcon={teachingLogsLoading ? <CircularProgress size={16} color="inherit" /> : <AssignmentIcon fontSize="small" />}
                    sx={{
                      borderRadius: 0,
                      borderColor: '#0284c7',
                      color: '#0369a1',
                      bgcolor: '#f0f9ff',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      py: 0.6,
                      px: 1.5,
                      '&:hover': {
                        bgcolor: '#e0f2fe',
                        borderColor: '#0369a1'
                      }
                    }}
                  >
                    {teachingLogsLoading ? 'กำลังเตรียมพิมพ์...' : 'รายงานบันทึกการสอน (A4)'}
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    onClick={handleExportExcel}
                    startIcon={<FileDownloadIcon fontSize="small" />}
                    sx={{
                      borderRadius: 0,
                      borderColor: '#cbd5e1',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      py: 0.6,
                      px: 1.5
                    }}
                  >
                    ส่งออก Excel
                  </Button>
                </Box>
              )}
            </Box>

            {/* Academic System Info Banner (Direct match with MisSchool Academic Menu 5.22.1) */}
            {matrixData && (
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  bgcolor: '#f8fafc',
                  borderBottom: '1px solid #cbd5e1',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  fontSize: '0.92rem'
                }}
              >
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, color: '#334155', fontSize: '0.92rem' }}>
                  <span><strong>เวลาที่เรียน:</strong> {matrixData.info.amountWeek} สัปดาห์</span>
                  <span>•</span>
                  <span><strong>เรียน:</strong> {matrixData.info.amountTeachPerWeek} ชั่วโมง/สัปดาห์</span>
                  <span>•</span>
                  <span><strong>คาบเรียนทั้งหมด:</strong> {matrixData.info.amountTeachAll} คาบ</span>
                  <span>•</span>
                  <span><strong>ขาดได้:</strong> {matrixData.info.amountAbsentMax} คาบ</span>
                  <span>•</span>
                  <span><strong>เรียนวัน:</strong> {matrixData.info.teachWeekDay}</span>
                  <span>•</span>
                  <span style={{ color: '#0369a1', fontWeight: 700 }}><strong>สอนแล้ว:</strong> {matrixData.info.totalTaughtSessions} คาบ</span>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.88rem' }}>
                    วันที่เปิดเรียน:
                  </Typography>
                  <TextField
                    type="date"
                    size="small"
                    value={customDateBegin || matrixData.info.dateBegin || ''}
                    onChange={(e) => setCustomDateBegin(e.target.value)}
                    sx={{
                      width: 150,
                      '& input': { py: 0.4, px: 1, fontSize: '0.88rem', fontFamily: 'monospace' },
                      bgcolor: '#fff',
                      borderRadius: 0
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Matrix Table (Sticky ONLY Left Columns: เลขที่, เลขประจำตัว, ชื่อ-สกุล) */}
            <TableContainer sx={{ maxHeight: '74vh', width: '100%', overflow: 'auto' }}>
              {matrixLoading ? (
                <Box sx={{ py: 10, textAlign: 'center' }}>
                  <CircularProgress size={32} sx={{ color: '#1e3a8a', mb: 1.5 }} />
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    กำลังโหลดข้อมูล...
                  </Typography>
                </Box>
              ) : matrixError ? (
                <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
                  <Alert severity="error" sx={{ display: 'inline-flex', borderRadius: 0 }}>{matrixError}</Alert>
                </Box>
              ) : !matrixData ? (
                <Box sx={{ py: 10, textAlign: 'center', color: '#64748b' }}>
                  <SchoolIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                  <Typography variant="body2">
                    โปรดเลือก ภาคเรียน รายวิชา และห้องเรียน ด้านบนเพื่อแสดงข้อมูล
                  </Typography>
                </Box>
              ) : matrixData.students.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', color: '#64748b' }}>
                  <Typography variant="body2">ไม่พบรายชื่อนักเรียนในห้องเรียนนี้</Typography>
                </Box>
              ) : (
                <Table className="matrix-table" size="small">
                  <TableHead>
                    {/* Row 1: Months */}
                    <TableRow>
                      {/* Left 3 Columns: Spans all 4 header rows */}
                      <TableCell
                        rowSpan={4}
                        align="center"
                        className="th-corner-1"
                        sx={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          py: 0.8
                        }}
                      >
                        เลขที่
                      </TableCell>
                      <TableCell
                        rowSpan={4}
                        align="center"
                        className="th-corner-2"
                        sx={{
                          fontSize: '0.92rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          py: 0.8
                        }}
                      >
                        เลขประจำตัว
                      </TableCell>
                      <TableCell
                        rowSpan={4}
                        align="left"
                        className="th-corner-3"
                        sx={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          pl: 1.5,
                          py: 0.8
                        }}
                      >
                        ชื่อ - สกุล
                      </TableCell>

                      {/* Month Headers */}
                      {activeMonthGroups.map((m) => (
                        <TableCell
                          key={m.monthKey}
                          colSpan={m.colspan}
                          align="center"
                          sx={{
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            borderRight: '1px solid #cbd5e1',
                            borderBottom: '1px solid #cbd5e1',
                            py: 0.7
                          }}
                        >
                          {m.monthName} {m.yearThai}
                        </TableCell>
                      ))}

                      {/* Summary Header (Spans rows 1, 2, 3) */}
                      <TableCell
                        colSpan={4}
                        rowSpan={3}
                        align="center"
                        className="th-summary-header"
                        sx={{
                          color: '#0f172a',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          borderLeft: '2px solid #64748b',
                          borderBottom: '1px solid #cbd5e1',
                          py: 0.7
                        }}
                      >
                        สรุปเวลาเรียน
                      </TableCell>
                    </TableRow>

                    {/* Row 2: Weeks */}
                    <TableRow>
                      {activeMonthGroups.map((m) => (
                        m.weekGroups.map(w => (
                          <TableCell
                            key={`${m.monthKey}-${w.weekNo}`}
                            colSpan={w.colspan}
                            align="center"
                            sx={{
                              color: '#334155',
                              fontSize: '0.86rem',
                              fontWeight: 600,
                              py: 0.5,
                              borderRight: '1px solid #cbd5e1',
                              borderBottom: '1px solid #cbd5e1'
                            }}
                          >
                            สัปดาห์ {w.weekNo}
                          </TableCell>
                        ))
                      ))}
                    </TableRow>

                    {/* Row 3: Dates */}
                    <TableRow>
                      {activeMonthGroups.map((m) => (
                        m.weekGroups.map(w => (
                          w.dateGroups ? (
                            w.dateGroups.map(d => (
                              <TableCell
                                key={d.dateStr}
                                colSpan={d.colspan}
                                align="center"
                                sx={{
                                  color: '#0f172a',
                                  fontSize: '0.88rem',
                                  fontWeight: 600,
                                  py: 0.5,
                                  px: 0.5,
                                  borderRight: '1px solid #cbd5e1',
                                  borderBottom: '1px solid #cbd5e1'
                                }}
                              >
                                {d.dateNum}
                              </TableCell>
                            ))
                          ) : (
                            <TableCell key={w.weekNo} colSpan={w.colspan} sx={{ borderRight: '1px solid #cbd5e1' }} />
                          )
                        ))
                      ))}
                    </TableRow>

                    {/* Row 4: Period Numbers & Summary Titles */}
                    <TableRow>
                      {/* Cumulative Periods (1, 2, 3, 4, 5...) */}
                      {activeColumns.map((c, i) => (
                        <TableCell
                          key={i}
                          align="center"
                          sx={{
                            color: '#475569',
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            py: 0.5,
                            px: 0.5,
                            minWidth: 32,
                            maxWidth: 32,
                            borderRight: '1px solid #cbd5e1',
                            borderBottom: '2px solid #64748b'
                          }}
                          title={`คาบที่ ${c.periodSeq || (i + 1)} (${c.dayShortName || ''} คาบ ${c.timeNo})`}
                        >
                          {c.periodSeq || (i + 1)}
                        </TableCell>
                      ))}

                      {/* Summary Columns Headers */}
                      <TableCell align="center" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', width: 38, py: 0.5, borderLeft: '2px solid #64748b', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #64748b' }}>
                        มา
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', width: 38, py: 0.5, borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #64748b' }}>
                        ขาด
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', width: 38, py: 0.5, borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #64748b' }}>
                        ลา
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.88rem', width: 44, py: 0.5, borderBottom: '2px solid #64748b' }}>
                        %
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {matrixData.students.map((std) => {
                      return (
                        <TableRow
                          key={std.stdNo}
                          sx={{
                            bgcolor: '#ffffff',
                            '&:hover': { bgcolor: '#f8fafc' },
                            '& td': { py: 0.6 }
                          }}
                        >
                          {/* 1. เลขที่ (Sticky Left) */}
                          <TableCell
                            align="center"
                            className="tb-sticky-1"
                            sx={{
                              color: '#64748b',
                              fontSize: '0.9rem',
                              fontWeight: 600,
                              borderRight: '1px solid #e2e8f0',
                              borderBottom: '1px solid #e2e8f0'
                            }}
                          >
                            {std.no}
                          </TableCell>

                          {/* 2. เลขประจำตัว (Sticky Left) */}
                          <TableCell
                            align="center"
                            className="tb-sticky-2"
                            sx={{
                              fontFamily: 'monospace, Sarabun',
                              fontSize: '0.9rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              borderRight: '1px solid #e2e8f0',
                              borderBottom: '1px solid #e2e8f0'
                            }}
                            title={std.citizenId ? `บัตรประชาชน: ${std.citizenId}` : ''}
                          >
                            {std.stdNo}
                          </TableCell>

                          {/* 3. ชื่อ - สกุล (Sticky Left) */}
                          <TableCell
                            align="left"
                            className="tb-sticky-3"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.95rem',
                              color: '#0f172a',
                              pl: 1.5,
                              borderRight: '2px solid #64748b',
                              borderBottom: '1px solid #e2e8f0',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {std.stdName}
                          </TableCell>

                          {/* Attendance Check Cells (Direct match with MisSchool Academic) */}
                          {activeColumns.map((col, ci) => {
                            const chk = std.checks.find(k => k.periodSeq === col.periodSeq)
                            const code = chk ? chk.code : ''
                            let displayChar = ''
                            let color = '#334155'
                            let bg = 'transparent'

                            if (code === 'ข') {
                              displayChar = 'ข'
                              color = '#dc2626' // Red
                              bg = '#fee2e2'
                            } else if (code === 'ม' || code === '/') {
                              displayChar = 'ม' // Blue (Matches MisSchool Academic)
                              color = '#1d4ed8'
                            } else if (code === 'ล') {
                              displayChar = 'ล'
                              color = '#d97706'
                              bg = '#fef3c7'
                            } else if (code === 'ป') {
                              displayChar = 'ป'
                              color = '#ea580c'
                              bg = '#ffedd5'
                            } else {
                              displayChar = ''
                              bg = col.isChecked ? 'transparent' : '#fcfcfc'
                            }

                            return (
                              <TableCell
                                key={col.periodSeq || ci}
                                align="center"
                                sx={{
                                  px: 0.3,
                                  fontSize: '1.05rem',
                                  fontWeight: displayChar === 'ข' ? 700 : 600,
                                  color,
                                  bgcolor: bg,
                                  borderRight: '1px solid #e2e8f0',
                                  borderBottom: '1px solid #e2e8f0'
                                }}
                              >
                                {displayChar}
                              </TableCell>
                            )
                          })}

                          {/* Summary Columns */}
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#1d4ed8', borderLeft: '2px solid #64748b', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontSize: '0.92rem' }}>
                            {std.summary.present}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#dc2626', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontSize: '0.92rem' }}>
                            {std.summary.absent}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#d97706', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', fontSize: '0.92rem' }}>
                            {std.summary.leave}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', fontSize: '0.92rem' }}>
                            {std.summary.percent}%
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </TableContainer>

            {/* Signature Section on Web View */}
            {matrixData && (
              <Box
                className="no-print"
                sx={{
                  p: 2,
                  borderTop: '1px solid #cbd5e1',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-around',
                  textAlign: 'center',
                  fontSize: '0.88rem',
                  fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif"
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 500 }}>
                    ลงชื่อ..............................................................ครูผู้สอน
                  </Typography>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>
                    ({teacher?.TeacherName || teacher?.TeacherNo})
                  </Typography>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.82rem', color: '#64748b' }}>
                    วันที่ .......... / .......... / ..............
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 500 }}>
                    ลงชื่อ..............................................................หัวหน้าแผนกวิชา
                  </Typography>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.88rem', color: '#334155' }}>
                    (..............................................................)
                  </Typography>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.82rem', color: '#64748b' }}>
                    วันที่ .......... / .......... / ..............
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 500 }}>
                    ลงชื่อ..............................................................หัวหน้างานพัฒนาหลักสูตรฯ
                  </Typography>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.88rem', color: '#334155' }}>
                    (..............................................................)
                  </Typography>
                  <Typography sx={{ fontFamily: 'inherit', fontSize: '0.82rem', color: '#64748b' }}>
                    วันที่ .......... / .......... / ..............
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        </Container>

        {/* PRINT TEMPLATE - ATTENDANCE (Sarabun font for paper A4 with Auto Multi-Page Chunking) */}
        {printMode === 'attendance' && matrixData && (
          <div className="print-only" style={{ padding: '2px', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
            {printPages.map((page) => {
              return (
                <div key={page.pageIndex} className="print-page" style={{ marginBottom: page.isLastPage ? 0 : '16px', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
                  {/* Page Top Header - Clean & Border-Free */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', marginBottom: '6px', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src="/img/logo.png" alt="โลโก้" style={{ width: '46px', height: '46px', objectFit: 'contain' }} />
                      <div>
                        <div style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", fontWeight: 700, fontSize: '13.5pt', lineHeight: 1.2, color: '#000' }}>
                          วิทยาลัยเทคโนโลยีศรีราชา
                        </div>
                        <div style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", fontWeight: 600, fontSize: '11pt', lineHeight: 1.3, color: '#000' }}>
                          สมุดบันทึกเวลาเรียนและการเข้าสอน
                        </div>
                        <div style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", fontSize: '9.5pt', color: '#111' }}>
                          วิชา: {matrixData.info.subNo} {matrixData.info.subjectName} | ห้อง: {matrixData.info.className && matrixData.info.className !== matrixData.info.classNo ? `${matrixData.info.className} (${matrixData.info.classNo})` : matrixData.info.classNo}
                        </div>
                        <div style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", fontSize: '8.5pt', color: '#334155', marginTop: '1px' }}>
                          เวลาเรียน {matrixData.info.amountWeek} สัปดาห์ • {matrixData.info.amountTeachPerWeek} คาบ/สัปดาห์ • ทั้งหมด {matrixData.info.amountTeachAll} คาบ • ขาดได้ {matrixData.info.amountAbsentMax} คาบ • เรียนวัน: {matrixData.info.teachWeekDay}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '9.5pt', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", color: '#000' }}>
                      <div>อาจารย์ผู้สอน: {teacher?.TeacherName || teacher?.TeacherNo}</div>
                      <div>ภาคเรียนที่: {matrixData.info.term}/{matrixData.info.year}</div>
                      {page.totalPages > 1 && (
                        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                          หน้า {page.pageIndex} / {page.totalPages}
                          {page.pageLabel && ` (${page.pageLabel})`}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Page Table */}
                  <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10pt', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
                    <thead>
                      {/* Row 1: Months */}
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th rowSpan={4} style={{ border: '1px solid #000', padding: '3px 2px', width: '36px', fontSize: '10pt' }}>เลขที่</th>
                        <th rowSpan={4} style={{ border: '1px solid #000', padding: '3px 2px', width: '80px', fontSize: '10pt' }}>เลขประจำตัว</th>
                        <th rowSpan={4} style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'center', width: '160px', fontSize: '10pt' }}>ชื่อ - สกุล</th>
                        {page.monthGroups.map(m => (
                          <th key={m.monthKey} colSpan={m.colspan} style={{ border: '1px solid #000', padding: '3px 2px', fontSize: '10pt' }}>{m.monthName}</th>
                        ))}
                        {page.isLastCol && (
                          <th colSpan={4} rowSpan={3} style={{ border: '1px solid #000', padding: '3px 2px', width: '115px', fontSize: '10pt' }}>สรุป</th>
                        )}
                      </tr>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        {page.monthGroups.map(m => (
                          m.weekGroups.map(w => (
                            <th key={`${m.monthKey}-${w.weekNo}`} colSpan={w.colspan} style={{ border: '1px solid #000', padding: '2px 1px', fontSize: '9.5pt' }}>ส.{w.weekNo}</th>
                          ))
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        {page.monthGroups.map(m => (
                          m.weekGroups.map(w => (
                            w.dateGroups ? (
                              w.dateGroups.map(d => (
                                <th key={d.dateStr} colSpan={d.colspan} style={{ border: '1px solid #000', padding: '2px 1px', fontSize: '9.5pt' }}>{d.dateNum}</th>
                              ))
                            ) : (
                              <th key={w.weekNo} colSpan={w.colspan} style={{ border: '1px solid #000' }} />
                            )
                          ))
                        ))}
                      </tr>
                      <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                        {page.columns.map((c, i) => (
                          <th key={i} style={{ border: '1px solid #000', padding: '2px 1px', minWidth: '20px', fontSize: '9.5pt' }}>{c.periodSeq || (page.colStart + i + 1)}</th>
                        ))}
                        {page.isLastCol && (
                          <>
                            <th style={{ border: '1px solid #000', padding: '2px 1px', width: '28px', fontSize: '9.5pt' }}>มา</th>
                            <th style={{ border: '1px solid #000', padding: '2px 1px', width: '28px', fontSize: '9.5pt' }}>ขาด</th>
                            <th style={{ border: '1px solid #000', padding: '2px 1px', width: '28px', fontSize: '9.5pt' }}>ลา</th>
                            <th style={{ border: '1px solid #000', padding: '2px 1px', width: '34px', fontSize: '9.5pt' }}>%</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {page.students.map((std) => {
                        const pageChecks = page.columns.map(col => {
                          return std.checks.find(k => k.periodSeq === col.periodSeq)
                        })
                        return (
                          <tr key={std.stdNo}>
                            <td style={{ border: '1px solid #000', padding: '3px 2px', fontSize: '10pt' }}>{std.no}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 2px', fontSize: '10pt' }}>{std.stdNo}</td>
                            <td style={{ border: '1px solid #000', padding: '3px 5px', textAlign: 'left', whiteSpace: 'nowrap', fontSize: '10pt' }}>{std.stdName}</td>
                            {pageChecks.map((chk, ci) => {
                              const code = chk ? chk.code : ''
                              let displayChar = ''
                              if (code === 'ข') displayChar = 'ข'
                              else if (code === 'ม' || code === '/') displayChar = '/'
                              else if (code === 'ล') displayChar = 'ล'
                              else if (code === 'ป') displayChar = 'ป'
                              return (
                                <td key={ci} style={{
                                  border: '1px solid #000',
                                  padding: '3px 1px',
                                  fontSize: '11pt',
                                  color: displayChar === 'ข' ? '#dc2626' : '#000',
                                  fontWeight: displayChar === 'ข' ? 'bold' : 'normal'
                                }}>
                                  {displayChar}
                                </td>
                              )
                            })}
                            {page.isLastCol && (
                              <>
                                <td style={{ border: '1px solid #000', padding: '3px 2px', fontWeight: 'bold', fontSize: '10pt' }}>{std.summary.present}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 2px', fontWeight: 'bold', fontSize: '10pt', color: std.summary.absent > 0 ? '#dc2626' : '#000' }}>{std.summary.absent}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 2px', fontWeight: 'bold', fontSize: '10pt' }}>{std.summary.leave}</td>
                                <td style={{ border: '1px solid #000', padding: '3px 2px', fontWeight: 'bold', fontSize: '10pt' }}>{std.summary.percent}%</td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Continuation Note (If not last page) */}
                  {!(page.isLastPage || page.pageIndex === page.totalPages) && (
                    <div style={{ textAlign: 'right', fontSize: '9pt', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", marginTop: '5px', fontStyle: 'italic' }}>
                      {!page.isLastRow ? (
                        `* มีต่อหน้าถัดไป (นักเรียนลำดับที่ ${page.stdEnd + 1} เป็นต้นไป)`
                      ) : !page.isLastCol ? (
                        `* มีต่อหน้าถัดไป (คาบที่ ${page.colEnd + 1} เป็นต้นไป)`
                      ) : null}
                    </div>
                  )}

                  {/* Signatures on Last Page (Guaranteed on Final Page) */}
                  {(page.isLastPage || page.pageIndex === page.totalPages) && (
                    <div
                      className="signature-section"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        textAlign: 'center',
                        fontSize: '10pt',
                        marginTop: '16px',
                        fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif",
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <p style={{ margin: '2px 0', fontSize: '10pt' }}>ลงชื่อ..............................................................ครูผู้สอน</p>
                        <p style={{ margin: '2px 0', fontSize: '10pt', fontWeight: 600 }}>({teacher?.TeacherName || teacher?.TeacherNo})</p>
                        <p style={{ margin: '2px 0', fontSize: '9.5pt', color: '#333' }}>วันที่ .......... / .......... / ..............</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <p style={{ margin: '2px 0', fontSize: '10pt' }}>ลงชื่อ..............................................................หัวหน้าแผนกวิชา</p>
                        <p style={{ margin: '2px 0', fontSize: '10pt' }}>(..............................................................)</p>
                        <p style={{ margin: '2px 0', fontSize: '9.5pt', color: '#333' }}>วันที่ .......... / .......... / ..............</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <p style={{ margin: '2px 0', fontSize: '10pt' }}>ลงชื่อ..............................................................หัวหน้างานพัฒนาหลักสูตรฯ</p>
                        <p style={{ margin: '2px 0', fontSize: '10pt' }}>(..............................................................)</p>
                        <p style={{ margin: '2px 0', fontSize: '9.5pt', color: '#333' }}>วันที่ .......... / .......... / ..............</p>
                      </div>
                    </div>
                  )}
              </div>
            )
          })}
          </div>
        )}

        {/* PRINT TEMPLATE - TEACHING LOG (A4 Portrait • 1 Sheet per Teaching Session) */}
        {printMode === 'teaching-log' && teachingLogsData && (
          <div className="print-only" style={{ padding: '0', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
            {teachingLogsData.logs.map((log, idx) => {
              const isLast = idx === teachingLogsData.logs.length - 1
              return (
                <div
                  key={log.index}
                  className="print-page print-portrait-page"
                  style={{
                    pageBreakAfter: isLast ? 'auto' : 'always',
                    breakAfter: isLast ? 'auto' : 'page',
                    boxSizing: 'border-box',
                    minHeight: '260mm',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif",
                    color: '#000',
                    backgroundColor: '#ffffff',
                    background: '#ffffff',
                    padding: '8px 12px'
                  }}
                >
                  <div>
                    {/* 1. Logo & Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '14px' }}>
                      <img src="/img/logo.png" alt="โลโก้" style={{ width: '58px', height: '58px', objectFit: 'contain' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '15pt', fontWeight: 700, lineHeight: 1.2 }}>
                          วิทยาลัยเทคโนโลยีศรีราชา
                        </div>
                        <div style={{ fontSize: '13.5pt', fontWeight: 700, marginTop: '3px', color: '#0f172a' }}>
                          บันทึกหลังการสอน ครั้งที่ {log.index}
                        </div>
                      </div>
                    </div>

                    {/* 2. Course & Class Info Box */}
                    <div
                      style={{
                        padding: '2px 0',
                        marginBottom: '12px',
                        fontSize: '10pt',
                        lineHeight: 1.65,
                        border: 'none'
                      }}
                    >
                      {/* Row 1: วิชา & ภาคเรียนที่ */}
                      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, marginRight: '20px' }}>
                          <strong style={{ whiteSpace: 'nowrap', marginRight: '6px' }}>วิชา:</strong>
                          <span style={{ flex: 1, borderBottom: '1px dotted #444', paddingBottom: '1px' }}>
                            {teachingLogsData.info.subNo} {teachingLogsData.info.subjectName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', width: '150px' }}>
                          <strong style={{ whiteSpace: 'nowrap', marginRight: '6px' }}>ภาคเรียนที่:</strong>
                          <span style={{ flex: 1, borderBottom: '1px dotted #444', paddingBottom: '1px', textAlign: 'center' }}>
                            {teachingLogsData.info.term}/{teachingLogsData.info.year}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: ระดับชั้น & คาบที่ */}
                      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, marginRight: '20px' }}>
                          <strong style={{ whiteSpace: 'nowrap', marginRight: '6px' }}>ระดับชั้น:</strong>
                          <span style={{ flex: 1, borderBottom: '1px dotted #444', paddingBottom: '1px' }}>
                            {teachingLogsData.info.className && teachingLogsData.info.className !== teachingLogsData.info.classNo ? `${teachingLogsData.info.className} (${teachingLogsData.info.classNo})` : teachingLogsData.info.classNo}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', width: '150px' }}>
                          <strong style={{ whiteSpace: 'nowrap', marginRight: '6px' }}>คาบที่:</strong>
                          <span style={{ flex: 1, borderBottom: '1px dotted #444', paddingBottom: '1px', textAlign: 'center' }}>
                            {log.periods}
                          </span>
                        </div>
                      </div>

                      {/* Row 3: วันที่ & อาจารย์ผู้สอน */}
                      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', flex: 1, marginRight: '20px' }}>
                          <strong style={{ whiteSpace: 'nowrap', marginRight: '6px' }}>วันที่:</strong>
                          <span style={{ flex: 1, borderBottom: '1px dotted #444', paddingBottom: '1px' }}>
                            {log.dateThai}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', width: '190px' }}>
                          <strong style={{ whiteSpace: 'nowrap', marginRight: '6px' }}>อาจารย์ผู้สอน:</strong>
                          <span style={{ flex: 1, borderBottom: '1px dotted #444', paddingBottom: '1px', textAlign: 'center' }}>
                            {teachingLogsData.info.teacherName}
                          </span>
                        </div>
                      </div>

                      {/* Row 4: จำนวนนักศึกษา */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '6px' }}>
                        <div>
                          <strong>จำนวนนักศึกษา:</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>เต็ม</span>
                          <span style={{ borderBottom: '1px dotted #444', width: '50px', display: 'inline-block', paddingBottom: '1px', textAlign: 'center', fontWeight: 600 }}>
                            {log.totalStudents !== '' && log.totalStudents !== undefined ? log.totalStudents : '\u00A0'}
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>คน</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>เข้าเรียน</span>
                          <span style={{ borderBottom: '1px dotted #444', width: '50px', display: 'inline-block', paddingBottom: '1px', textAlign: 'center', fontWeight: 600 }}>
                            {log.presentStudents !== '' && log.presentStudents !== undefined ? log.presentStudents : '\u00A0'}
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>คน</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ whiteSpace: 'nowrap' }}>ขาด</span>
                          <span style={{ borderBottom: '1px dotted #444', width: '50px', display: 'inline-block', paddingBottom: '1px', textAlign: 'center', fontWeight: 600 }}>
                            {log.absentStudents !== '' && log.absentStudents !== undefined ? log.absentStudents : '\u00A0'}
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>คน</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Learning Content Section */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10.5pt', fontWeight: 700, marginBottom: '4px' }}>
                        เนื้อหา / สาระการจัดการเรียนรู้:
                      </div>
                      {renderRuledNotes(log.content)}
                    </div>

                    {/* 4. Assignments / Activities Section */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10.5pt', fontWeight: 700, marginBottom: '4px' }}>
                        งานที่มอบหมาย / กิจกรรมการเรียนรู้:
                      </div>
                      {renderRuledNotes(log.orderWork)}
                    </div>

                    {/* 5. Notes / Remarks Section */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10.5pt', fontWeight: 700, marginBottom: '4px' }}>
                        หมายเหตุ:
                      </div>
                      {renderRuledNotes(log.note)}
                    </div>
                  </div>

                  {/* 6. Signatures Section */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      textAlign: 'center',
                      fontSize: '10pt',
                      marginTop: '24px',
                      paddingTop: '12px',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }}
                  >
                    {/* Signature 1: ครูผู้สอน */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '220px' }}>
                      <p style={{ margin: '2px 0' }}>ลงชื่อ..............................................................</p>
                      <p style={{ margin: '2px 0' }}>
                        (&nbsp;<span style={{ borderBottom: '1px dotted #444', padding: '0 12px', fontWeight: 600 }}>{teachingLogsData.info.teacherName}</span>&nbsp;)
                      </p>
                      <p style={{ margin: '2px 0' }}>ครูผู้สอน</p>
                      <p style={{ margin: '2px 0', fontSize: '9pt', color: '#333' }}>วันที่ .......... / .......... / ..............</p>
                    </div>

                    {/* Signature 2: หัวหน้างานพัฒนาหลักสูตรและจัดการเรียนรู้ */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '220px' }}>
                      <p style={{ margin: '2px 0' }}>ลงชื่อ..............................................................</p>
                      <p style={{ margin: '2px 0' }}>(..............................................................)</p>
                      <p style={{ margin: '2px 0' }}>หัวหน้างานพัฒนาหลักสูตรและจัดการเรียนรู้</p>
                      <p style={{ margin: '2px 0', fontSize: '9pt', color: '#333' }}>วันที่ .......... / .......... / ..............</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Dialog: เลือกรูปแบบการพิมพ์บันทึกหลังการสอน */}
        <Dialog
          open={teachingLogDialogOpen}
          onClose={() => setTeachingLogDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 0,
              fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif",
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '1.2rem', pb: 1, borderBottom: '1px solid #e2e8f0' }}>
            เลือกรูปแบบการพิมพ์บันทึกหลังการสอน (A4)
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            {/* Section 1: รูปแบบคาบ */}
            <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
              <FormLabel component="legend" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.2, fontSize: '1rem' }}>
                1. รูปแบบการจัดหน้า / คาบสอน:
              </FormLabel>
              <RadioGroup
                value={printReportMode}
                onChange={(e) => setPrintReportMode(e.target.value)}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    mb: 1.5,
                    borderRadius: 0,
                    borderColor: printReportMode === 'combined' ? '#0284c7' : '#cbd5e1',
                    bgcolor: printReportMode === 'combined' ? '#f0f9ff' : '#fff',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPrintReportMode('combined')}
                >
                  <FormControlLabel
                    value="combined"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          แบบรวมคาบคู่ (1 ครั้งการสอน = 1 แผ่น A4)
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          รวมคาบที่สอนในวันเดียวกัน เช่น คาบ 1-2 หรือ 5-6 เป็น 1 แผ่น (หากแต่ละคาบสอนต่างเรื่องกัน ระบบจะแยกหัวข้อย่อยให้อัตโนมัติ)
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 0,
                    borderColor: printReportMode === 'single' ? '#0284c7' : '#cbd5e1',
                    bgcolor: printReportMode === 'single' ? '#f0f9ff' : '#fff',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPrintReportMode('single')}
                >
                  <FormControlLabel
                    value="single"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          แบบแยกรายคาบ (1 คาบ = 1 แผ่น A4)
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          พิมพ์แยกรายคาบเดี่ยว คาบที่ 1, คาบที่ 2, คาบที่ 3... 1 แผ่นต่อ 1 คาบเดี่ยวตลอดหลักสูตร
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Paper>
              </RadioGroup>
            </FormControl>

            {/* Section 2: ขอบเขตการพิมพ์ */}
            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.2, fontSize: '1rem' }}>
                2. ขอบเขตข้อมูลที่ต้องการพิมพ์:
              </FormLabel>
              <RadioGroup
                value={printReportScope}
                onChange={(e) => setPrintReportScope(e.target.value)}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    mb: 1.5,
                    borderRadius: 0,
                    borderColor: printReportScope === 'all' ? '#0284c7' : '#cbd5e1',
                    bgcolor: printReportScope === 'all' ? '#f0f9ff' : '#fff',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPrintReportScope('all')}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          ครบทุกคาบตลอดหลักสูตร (รวมคาบที่ยังไม่ได้บันทึกสอน)
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          พิมพ์ครบทุกคาบ (คาบที่ยังไม่ได้ลงบันทึกจะเว้นว่างเส้นประไว้สำหรับเขียนด้วยลายมือ)
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 0,
                    borderColor: printReportScope === 'recorded' ? '#0284c7' : '#cbd5e1',
                    bgcolor: printReportScope === 'recorded' ? '#f0f9ff' : '#fff',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPrintReportScope('recorded')}
                >
                  <FormControlLabel
                    value="recorded"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          เฉพาะคาบที่มีการบันทึกสอนแล้ว
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                          พิมพ์เฉพาะครั้งหรือคาบที่ครูได้ลงบันทึกการสอนในระบบเรียบร้อยแล้วเท่านั้น
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                </Paper>
              </RadioGroup>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 1.5, borderTop: '1px solid #e2e8f0', gap: 1 }}>
            <Button
              onClick={() => setTeachingLogDialogOpen(false)}
              variant="outlined"
              sx={{ borderRadius: 0, color: '#64748b', borderColor: '#cbd5e1' }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => handlePrintTeachingLog(printReportMode, printReportScope)}
              variant="contained"
              disabled={teachingLogsLoading}
              startIcon={teachingLogsLoading ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
              sx={{
                borderRadius: 0,
                bgcolor: '#0284c7',
                '&:hover': { bgcolor: '#0369a1' },
                px: 3
              }}
            >
              {teachingLogsLoading ? 'กำลังเตรียมพิมพ์...' : 'พิมพ์รายงาน (Print)'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  )
}
