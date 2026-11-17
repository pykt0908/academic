import React, { useState, useEffect, useMemo } from 'react'
import {
  FileSpreadsheet,
  Download,
  ArrowLeft,
  Calendar,
  Layers,
  School,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

const THAI_MONTH_OPTIONS = [
  { value: 'all', label: 'ทุกเดือน (ตลอดภาคเรียน)' },
  { value: '5', label: 'พฤษภาคม' },
  { value: '6', label: 'มิถุนายน' },
  { value: '7', label: 'กรกฎาคม' },
  { value: '8', label: 'สิงหาคม' },
  { value: '9', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' },
  { value: '1', label: 'มกราคม' },
  { value: '2', label: 'กุมภาพันธ์' },
  { value: '3', label: 'มีนาคม' },
  { value: '4', label: 'เมษายน' }
]

export default function EditorDownload({ onNavigateHome }) {
  const [term, setTerm] = useState('2')
  const [year, setYear] = useState('2569')
  const [selectedMonth, setSelectedMonth] = useState('all')
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

  // Filtered class list by level
  const filteredClassList = useMemo(() => {
    if (selectedLevel === 'all') return classes
    return classes.filter(c => {
      if (selectedLevel === 'ปวช.') return c.LavelName?.includes('ปวช')
      if (selectedLevel === 'ปวส.') return c.LavelName?.includes('ปวส')
      return true
    })
  }, [classes, selectedLevel])

  // Reset selectedClass to 'all' if selectedClass is not in the filtered list
  useEffect(() => {
    if (selectedClass !== 'all' && !filteredClassList.some(c => c.ClassNo === selectedClass)) {
      setSelectedClass('all')
    }
  }, [filteredClassList, selectedClass])

  // Download Action
  const handleDownload = () => {
    setDownloading(true)
    setError('')
    setSuccessMsg('')

    const monthParam = selectedMonth !== 'all' ? `&month=${selectedMonth}` : ''
    const url = `/api/editor-download/export?term=${term}&year=${year}&classNo=${encodeURIComponent(selectedClass)}${monthParam}`

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
      const cLabel = selectedClass === 'all'
        ? `ทุกห้องเรียน (${filteredClassList.length} ห้อง)`
        : (classes.find(c => c.ClassNo === selectedClass)?.ClassName || selectedClass)
      setSuccessMsg(`ดาวน์โหลดไฟล์ Excel ของ ${cLabel} (${mLabel}) เรียบร้อยแล้ว`)
      setTimeout(() => setSuccessMsg(''), 5000)
    }, 1500)
  }

  // Label for active month
  const activeMonthLabel = selectedMonth !== 'all'
    ? (THAI_MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || selectedMonth)
    : 'ตลอดภาคเรียน'

  // Label for active target
  const activeTargetLabel = selectedClass === 'all'
    ? `ทุกห้องเรียน (${filteredClassList.length} ห้อง)`
    : (classes.find(c => c.ClassNo === selectedClass)?.ClassName || selectedClass)

  return (
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
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-800 flex items-center gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* Download Filter Card */}
        <div className="bg-white border border-slate-300 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span>ส่งออกสถิติการขาดเรียน (Excel)</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              แบบฟอร์มสถิติการขาดเรียนของนักศึกษา (งานปกครองนักเรียนนักศึกษา ฝ่ายพัฒนากิจการนักศึกษา)
            </p>
          </div>

          {/* Filter Form Controls */}
          <div className="space-y-4">
            {/* Row 1: Term & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>ภาคเรียน</span>
                </label>
                <select
                  value={term}
                  onChange={e => setTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคเรียนที่ 3 (ฤดูร้อน)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>ปีการศึกษา</span>
                </label>
                <select
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {Array.from(new Set(termsList.map(t => t.Year || t.year))).filter(Boolean).map(y => (
                    <option key={y} value={y}>พ.ศ. {y}</option>
                  ))}
                  {!termsList.some(t => (t.Year || t.year) === '2569') && <option value="2569">พ.ศ. 2569</option>}
                  {!termsList.some(t => (t.Year || t.year) === '2568') && <option value="2568">พ.ศ. 2568</option>}
                </select>
              </div>
            </div>

            {/* Row 2: Month & Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>ประจำเดือน</span>
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {THAI_MONTH_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>ระดับชั้น</span>
                </label>
                <select
                  value={selectedLevel}
                  onChange={e => setSelectedLevel(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">ทั้งหมด (ปวช. และ ปวส.)</option>
                  <option value="ปวช.">ระดับ ปวช.</option>
                  <option value="ปวส.">ระดับ ปวส.</option>
                </select>
              </div>
            </div>

            {/* Row 3: Classroom Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-slate-400" />
                  <span>ห้องเรียนที่ต้องการดาวน์โหลด</span>
                </span>
                {loading && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> กำลังโหลด...</span>}
              </label>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
              >
                <option value="all">
                  📁 ทุกห้องเรียน ({filteredClassList.length} ห้อง - รวมในไฟล์เดียว)
                </option>
                {filteredClassList.map(c => (
                  <option key={c.ClassNo} value={c.ClassNo}>
                    {c.ClassName || c.ClassNo} ({c.StudentCount || 0} คน)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selection Summary Pill */}
          <div className="bg-slate-50 p-3.5 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-800">เงื่อนไข: </span>
              <span>{activeTargetLabel}</span>
              <span className="mx-1 text-slate-400">•</span>
              <span>เดือน{activeMonthLabel}</span>
              <span className="mx-1 text-slate-400">•</span>
              <span>ภาคเรียนที่ {term}/{year}</span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              ฟอร์ม A4 แนวนอน
            </div>
          </div>

          {/* Download Action Button */}
          <div>
            <button
              onClick={handleDownload}
              disabled={downloading || loading || (selectedClass === 'all' && filteredClassList.length === 0)}
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังสร้างไฟล์ Excel...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>ดาวน์โหลดไฟล์ Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
