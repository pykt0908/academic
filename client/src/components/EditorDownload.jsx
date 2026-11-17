import React, { useState, useEffect, useMemo } from 'react'
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ArrowLeft,
  Users,
  Building2,
  CalendarCheck,
  GraduationCap,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function EditorDownload({ onNavigateHome }) {
  const [term, setTerm] = useState('2')
  const [year, setYear] = useState('2569')
  const [termsList, setTermsList] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('all') // 'all', 'ปวช.', 'ปวส.'
  const [downloadingClass, setDownloadingClass] = useState(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
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
        // Fallback default terms
        setTermsList([
          { Year: '2569', Term: '2' },
          { Year: '2569', Term: '1' },
          { Year: '2568', Term: '2' },
          { Year: '2568', Term: '1' }
        ])
      })
  }, [])

  // Fetch classrooms for selected term/year
  const fetchClasses = (t, y) => {
    setLoading(true)
    setError('')
    fetch(`/api/editor-download/classes?term=${t}&year=${y}`)
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
  }

  useEffect(() => {
    fetchClasses(term, year)
  }, [term, year])

  // Filtered classes
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const q = searchQuery.toLowerCase().trim()
      const matchSearch = !q ||
        (c.className && c.className.toLowerCase().includes(q)) ||
        (c.classNo && c.classNo.toLowerCase().includes(q)) ||
        (c.DepartNamefull && c.DepartNamefull.toLowerCase().includes(q))

      const matchLevel = selectedLevel === 'all' ||
        (selectedLevel === 'ปวช.' && c.LavelName && c.LavelName.includes('ปวช')) ||
        (selectedLevel === 'ปวส.' && c.LavelName && c.LavelName.includes('ปวส'))

      return matchSearch && matchLevel
    })
  }, [classes, searchQuery, selectedLevel])

  // Aggregate stats
  const totalStudents = useMemo(() => {
    return classes.reduce((sum, c) => sum + (c.StudentCount || 0), 0)
  }, [classes])

  const totalPeriods = useMemo(() => {
    return classes.reduce((sum, c) => sum + (c.PeriodsChecked || 0), 0)
  }, [classes])

  // Download Single Classroom Excel
  const handleDownloadClass = (classNo, className) => {
    setDownloadingClass(classNo)
    setSuccessMsg('')
    const url = `/api/editor-download/export?term=${term}&year=${year}&classNo=${encodeURIComponent(classNo)}`
    
    // Create invisible anchor to download
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `attendance_${classNo}_${term}_${year}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloadingClass(null)
      setSuccessMsg(`ดาวน์โหลดไฟล์ของ ${className} เรียบร้อยแล้ว`)
      setTimeout(() => setSuccessMsg(''), 4000)
    }, 1200)
  }

  // Download All Classrooms in One Excel
  const handleDownloadAll = () => {
    setDownloadingAll(true)
    setSuccessMsg('')
    const url = `/api/editor-download/export?term=${term}&year=${year}&classNo=all`

    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `attendance_monthly_all_classes_${term}_${year}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloadingAll(false)
      setSuccessMsg(`ดาวน์โหลดไฟล์รวมทุกห้องเรียน (${classes.length} ห้อง) เรียบร้อยแล้ว`)
      setTimeout(() => setSuccessMsg(''), 5000)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}>
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/img/logo.png" alt="ตราวิทยาลัย" className="w-10 h-10 object-contain" />
            <div>
              <div className="text-base sm:text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>วิทยาลัยเทคโนโลยีศรีราชา</span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-sm">
                  Excel Export
                </span>
              </div>
              <div className="text-xs sm:text-sm text-slate-500 font-medium">
                ระบบดาวน์โหลดสถิติเวลาเรียนรายเดือน (แยกห้องเรียนแบบละเอียด)
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้ารายงานเวลาเรียน</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800 flex items-center gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* Hero Section with Quick Stats & Big Download Button */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Monthly Attendance Exporter</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                ส่งออกสถิติเวลาเรียน (มา/ขาด/ลา/ป่วย) เป็น Excel
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                ดาวน์โหลดรายงานสถิติการมาเรียนและขาดเรียนรายเดือนของนักศึกษา แยกเป็นห้องแบบละเอียด พร้อมแถบสรุปรวมตลอดภาคเรียนและตารางบันทึกเวลาเรียนรายวัน
              </p>
            </div>

            {/* Big Action Button */}
            <div className="shrink-0 flex flex-col items-start lg:items-end gap-2">
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll || loading || classes.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-6 py-3.5 text-base font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingAll ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>กำลังสร้างไฟล์ Excel...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>ดาวน์โหลดรวมทุกห้องเรียน (.xlsx)</span>
                  </>
                )}
              </button>
              <span className="text-xs text-slate-400">
                * สร้างไฟล์ Excel เดียว รวมแท็บชีตของทุกห้องเรียน ({classes.length} ห้อง) พร้อมชีตสรุปภาพรวม
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-none border border-white/10">
              <Building2 className="w-8 h-8 text-blue-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-400 font-medium">ห้องเรียนที่มีข้อมูล</div>
                <div className="text-xl font-bold text-white">{classes.length} <span className="text-xs font-normal text-slate-400">ห้อง</span></div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-none border border-white/10">
              <Users className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-400 font-medium">นักศึกษาในระบบ</div>
                <div className="text-xl font-bold text-white">{totalStudents.toLocaleString()} <span className="text-xs font-normal text-slate-400">คน</span></div>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 bg-white/5 p-3 rounded-none border border-white/10">
              <CalendarCheck className="w-8 h-8 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-400 font-medium">คาบเรียนที่เช็คชื่อแล้ว</div>
                <div className="text-xl font-bold text-white">{totalPeriods.toLocaleString()} <span className="text-xs font-normal text-slate-400">คาบ</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Term Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 uppercase">ภาคเรียน:</label>
              <select
                value={term}
                onChange={e => setTerm(e.target.value)}
                className="px-3 py-1.5 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3 (ฤดูร้อน)</option>
              </select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 uppercase">ปีการศึกษา:</label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="px-3 py-1.5 text-sm font-semibold bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {Array.from(new Set(termsList.map(t => t.Year || t.year))).filter(Boolean).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
                {!termsList.some(t => (t.Year || t.year) === '2569') && <option value="2569">2569</option>}
                {!termsList.some(t => (t.Year || t.year) === '2568') && <option value="2568">2568</option>}
              </select>
            </div>

            {/* Level Filter Tabs */}
            <div className="flex items-center border border-slate-300 bg-slate-100 p-0.5 ml-0 sm:ml-2">
              <button
                onClick={() => setSelectedLevel('all')}
                className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${selectedLevel === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ทั้งหมด ({classes.length})
              </button>
              <button
                onClick={() => setSelectedLevel('ปวช.')}
                className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${selectedLevel === 'ปวช.' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ปวช.
              </button>
              <button
                onClick={() => setSelectedLevel('ปวส.')}
                className={`px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${selectedLevel === 'ปวส.' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ปวส.
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อห้องเรียน หรือ สาขาวิชา..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Classrooms List Table */}
        <div className="bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-800">
                รายการห้องเรียนสำหรับส่งออกสถิติ (พบ {filteredClasses.length} ห้อง)
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              * แต่ละไฟล์ประกอบด้วย: ชีตสถิติรายเดือน + ชีตบันทึกเวลาเรียนรายวัน
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <div className="text-sm font-semibold">กำลังดึงข้อมูลห้องเรียนจากฐานข้อมูล...</div>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-400" />
              <div className="text-base font-semibold text-slate-700">ไม่พบห้องเรียนที่ตรงกับเงื่อนไข</div>
              <div className="text-xs text-slate-400">โปรดลองเปลี่ยนคำค้นหา หรือเลือกภาคเรียน/ปีการศึกษาอื่น</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                    <th className="py-3 px-4 text-center w-12">ลำดับ</th>
                    <th className="py-3 px-4 w-28">รหัสห้อง</th>
                    <th className="py-3 px-4">ชื่อห้องเรียน</th>
                    <th className="py-3 px-4 w-32">ระดับชั้น</th>
                    <th className="py-3 px-4">สาขาวิชา</th>
                    <th className="py-3 px-4 text-center w-28">จำนวนนักศึกษา</th>
                    <th className="py-3 px-4 text-center w-28">วันที่เช็คชื่อ</th>
                    <th className="py-3 px-4 text-center w-28">คาบที่เช็ค</th>
                    <th className="py-3 px-4 text-center w-36">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredClasses.map((c, idx) => {
                    const isDownloadingThis = downloadingClass === c.ClassNo
                    return (
                      <tr key={c.ClassNo} className="hover:bg-blue-50/50 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-600">{c.ClassNo}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{c.ClassName}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-xs ${c.LavelName?.includes('ปวส') ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {c.LavelName || 'ปวช.'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{c.DepartNamefull || '-'}</td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-800">
                          {c.StudentCount || 0} คน
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600">
                          {c.DaysChecked || 0} วัน
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-mono">
                          {c.PeriodsChecked || 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDownloadClass(c.ClassNo, c.ClassName)}
                            disabled={isDownloadingThis}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-300 transition-all cursor-pointer disabled:opacity-50"
                            title={`ดาวน์โหลดสถิติ Excel ของ ${c.ClassName}`}
                          >
                            {isDownloadingThis ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>กำลังสร้าง...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>ดาวน์โหลด Excel</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
