import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, ClipboardCheck, QrCode, FileSpreadsheet, Settings,
  Search, Bell, Plus, Download, ChevronDown, CalendarDays, CheckCircle2,
  Clock3, XCircle, MoreHorizontal, ArrowUpRight, Sparkles, Menu, Trash2,
  Copy, RefreshCw, ExternalLink, ShieldCheck, GraduationCap, X, Check,
  UserRound, BookOpen, CircleHelp
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { cloudConfigured } from "./supabase";

type Status = "Present" | "Absent" | "Late" | "Excused";
type Student = { id: string; name: string; roll: string; email?: string; className: string };
type RecordEntry = { studentId: string; date: string; status: Status; className: string };
type Session = { id: string; className: string; createdAt: string; expiresAt: string; active: boolean };

const initialStudents: Student[] = [
  { id: "s1", name: "Aarav Sharma", roll: "CE-001", email: "aarav@example.com", className: "Computer Engineering" },
  { id: "s2", name: "Ananya Patel", roll: "CE-002", email: "ananya@example.com", className: "Computer Engineering" },
  { id: "s3", name: "Ishaan Verma", roll: "CE-003", email: "ishaan@example.com", className: "Computer Engineering" },
  { id: "s4", name: "Meera Joshi", roll: "CE-004", email: "meera@example.com", className: "Computer Engineering" },
  { id: "s5", name: "Rohan Kulkarni", roll: "CE-005", email: "rohan@example.com", className: "Computer Engineering" },
  { id: "s6", name: "Sara Khan", roll: "CE-006", email: "sara@example.com", className: "Computer Engineering" },
  { id: "s7", name: "Kabir Desai", roll: "CE-007", email: "kabir@example.com", className: "Computer Engineering" },
  { id: "s8", name: "Diya Shah", roll: "CE-008", email: "diya@example.com", className: "Computer Engineering" },
  { id: "s9", name: "Aditya Nair", roll: "CE-009", email: "aditya@example.com", className: "Computer Engineering" },
  { id: "s10", name: "Priya Singh", roll: "CE-010", email: "priya@example.com", className: "Computer Engineering" },
];

const today = new Date().toISOString().slice(0, 10);
const getStored = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
};
const saveStored = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const initials = (name: string) => name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
const statusClass = (s: Status) => s.toLowerCase();
const classes = ["Computer Engineering", "Mathematics", "Physics"];

export default function App() {
  const [page, setPage] = useState("Overview");
  const [students, setStudents] = useState<Student[]>(() => getStored("sa_students", initialStudents));
  const [records, setRecords] = useState<RecordEntry[]>(() => getStored("sa_records", []));
  const [sessions, setSessions] = useState<Session[]>(() => getStored("sa_sessions", []));
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(today);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRoll, setNewRoll] = useState("");
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [checkinName, setCheckinName] = useState("");
  const [checkinRoll, setCheckinRoll] = useState("");
  const [sessionStudentClass, setSessionStudentClass] = useState(classes[0]);

  useEffect(() => saveStored("sa_students", students), [students]);
  useEffect(() => saveStored("sa_records", records), [records]);
  useEffect(() => saveStored("sa_sessions", sessions), [sessions]);

  const classStudents = students.filter(s => s.className === selectedClass);
  const todayRecords = records.filter(r => r.date === date && r.className === selectedClass);
  const statusFor = (studentId: string) => todayRecords.find(r => r.studentId === studentId)?.status;
  const present = todayRecords.filter(r => r.status === "Present").length;
  const absent = todayRecords.filter(r => r.status === "Absent").length;
  const late = todayRecords.filter(r => r.status === "Late").length;
  const excused = todayRecords.filter(r => r.status === "Excused").length;
  const marked = todayRecords.length;
  const attendanceRate = classStudents.length ? Math.round((present / classStudents.length) * 100) : 0;
  const filteredStudents = classStudents.filter(s => `${s.name} ${s.roll}`.toLowerCase().includes(search.toLowerCase()));

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const mark = (studentId: string, status: Status) => {
    setRecords(prev => {
      const existing = prev.findIndex(r => r.studentId === studentId && r.date === date && r.className === selectedClass);
      const entry = { studentId, date, status, className: selectedClass };
      if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next; }
      return [...prev, entry];
    });
  };
  const markAllPresent = () => {
    const entries = classStudents.map(s => ({ studentId: s.id, date, status: "Present" as Status, className: selectedClass }));
    setRecords(prev => [...prev.filter(r => !(r.date === date && r.className === selectedClass)), ...entries]);
    showToast("Everyone marked present.");
  };
  const addStudent = () => {
    if (!newName.trim() || !newRoll.trim()) { showToast("Please enter both name and roll number."); return; }
    if (students.some(s => s.roll.toLowerCase() === newRoll.trim().toLowerCase() && s.className === selectedClass)) {
      showToast("This roll number already exists in the class."); return;
    }
    setStudents(prev => [...prev, { id: crypto.randomUUID(), name: newName.trim(), roll: newRoll.trim(), className: selectedClass }]);
    setNewName(""); setNewRoll(""); setShowAdd(false); showToast("Student added.");
  };
  const removeStudent = (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student || !confirm(`Remove ${student.name} from this roster?`)) return;
    setStudents(prev => prev.filter(s => s.id !== id));
    showToast("Student removed.");
  };
  const exportExcel = () => {
    const roster = students.map(s => ({ "Student name": s.name, "Roll number": s.roll, Class: s.className }));
    const detail = records.map(r => {
      const s = students.find(st => st.id === r.studentId);
      return { Date: r.date, Class: r.className, "Student name": s?.name ?? "Removed student", "Roll number": s?.roll ?? "", Status: r.status };
    });
    const summary = classes.map(c => {
      const rs = records.filter(r => r.className === c);
      return { Class: c, "Total students": students.filter(s => s.className === c).length, "Present records": rs.filter(r => r.status === "Present").length, "Absent records": rs.filter(r => r.status === "Absent").length, "Late records": rs.filter(r => r.status === "Late").length, "Excused records": rs.filter(r => r.status === "Excused").length };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roster), "Students");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Attendance");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.writeFile(wb, `Smart-Attendance-${date}.xlsx`);
    showToast("Excel report downloaded.");
  };
  const createSession = () => {
    const s: Session = { id: crypto.randomUUID(), className: selectedClass, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), active: true };
    setSessions(prev => [s, ...prev.map(x => ({ ...x, active: false }))]);
    setActiveSession(s);
    showToast("QR session created (expires in 15 minutes).");
  };
  const sessionUrl = activeSession ? `${window.location.origin}${window.location.pathname}?checkin=${activeSession.id}` : "";
  const openCheckinFromUrl = new URLSearchParams(window.location.search).get("checkin");
  useEffect(() => {
    if (openCheckinFromUrl) {
      const s = getStored<Session[]>("sa_sessions", []).find(x => x.id === openCheckinFromUrl);
      if (s) { setActiveSession(s); setSessionStudentClass(s.className); setPage("QR Session"); }
    }
  }, [openCheckinFromUrl]);
  const submitCheckin = () => {
    if (!activeSession) return;
    if (!activeSession.active || Date.now() > new Date(activeSession.expiresAt).getTime()) { showToast("This QR session has expired."); return; }
    const st = students.find(s => s.className === activeSession.className && s.roll.toLowerCase() === checkinRoll.trim().toLowerCase() && s.name.toLowerCase() === checkinName.trim().toLowerCase());
    if (!st) { showToast("Student name and roll number do not match the class roster."); return; }
    setRecords(prev => {
      if (prev.some(r => r.studentId === st.id && r.date === today && r.className === activeSession.className)) return prev;
      return [...prev, { studentId: st.id, date: today, status: "Present", className: activeSession.className }];
    });
    showToast(`Attendance submitted for ${st.name}.`);
    setCheckinName(""); setCheckinRoll("");
  };
  const navItems = [
    { name: "Overview", icon: LayoutDashboard }, { name: "Students", icon: Users },
    { name: "Attendance", icon: ClipboardCheck }, { name: "QR Session", icon: QrCode },
    { name: "Reports", icon: FileSpreadsheet }, { name: "Settings", icon: Settings },
  ];
  const selectedCount = classStudents.length;
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const rs = records.filter(r => r.date === iso && r.className === selectedClass && r.status === "Present");
    return { label: d.toLocaleDateString("en", { weekday: "short" }), count: rs.length };
  }), [records, selectedClass]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><GraduationCap size={22}/></div><div><strong>Attendly</strong><span>Teacher workspace</span></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.name} className={`nav-item ${page === item.name ? "active" : ""}`} onClick={() => { setPage(item.name); setSidebarOpen(false); }}><Icon size={18}/><span>{item.name}</span>{item.name === "Attendance" && <span className="nav-count">{marked}</span>}</button>; })}</nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><strong>Need a hand?</strong><p>Quick guide to get started.</p><button onClick={() => showToast("Tip: select a class, mark attendance, then export your Excel report.")}>View guide <ArrowUpRight size={13}/></button></div></div><div className="profile"><div className="avatar teacher">SC</div><div className="profile-text"><strong>Teacher Demo</strong><span>Individual account</span></div><MoreHorizontal size={19} className="muted"/></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="top-actions"><div className={`cloud-status ${cloudConfigured ? "connected" : ""}`}><span className="status-dot"/>{cloudConfigured ? "Cloud configured" : "Local demo mode"}</div><button className="icon-btn" title="Notifications" onClick={() => showToast("You're all caught up.")}><Bell size={18}/><i/></button><div className="avatar teacher small">SC</div></div></header>

        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow">MONDAY, {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</div><h1>{page === "Overview" ? "Good morning, Teacher 👋" : page}</h1><p>{page === "Overview" ? "Here's what's happening with your classes today." : page === "Attendance" ? "Take attendance and keep your class records up to date." : page === "Students" ? "Manage your students and class rosters." : page === "QR Session" ? "Create a secure QR check-in session for your class." : page === "Reports" ? "Review attendance trends and export your data." : "Manage your workspace preferences."}</p></div><div className="heading-actions"><select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="class-select">{classes.map(c => <option key={c}>{c}</option>)}</select><button className="btn-primary" onClick={() => { setPage("Attendance"); }}><ClipboardCheck size={16}/> Take attendance</button></div></div>

          {page === "Overview" && <>
            <div className="stats-grid">
              <StatCard label="Total students" value={String(selectedCount)} sub="In selected class" icon={<Users/>} tone="blue" trend="+2 this month"/>
              <StatCard label="Present today" value={String(present)} sub={`${attendanceRate}% attendance rate`} icon={<CheckCircle2/>} tone="green" trend={marked ? "Updated today" : "Not marked yet"}/>
              <StatCard label="Absent today" value={String(absent)} sub="Needs follow-up" icon={<XCircle/>} tone="orange" trend="Daily overview"/>
              <StatCard label="Late arrivals" value={String(late)} sub="Today's late check-ins" icon={<Clock3/>} tone="purple" trend="Daily overview"/>
            </div>
            <div className="content-grid">
              <section className="panel attendance-panel"><div className="panel-head"><div><h2>Today's attendance</h2><p>Attendance overview for {selectedClass}</p></div><button className="btn-light" onClick={() => setPage("Attendance")}>View attendance <ArrowUpRight size={15}/></button></div><div className="attendance-summary"><div className="ring" style={{"--percent":`${attendanceRate}%`} as React.CSSProperties}><div><strong>{attendanceRate}%</strong><span>Present</span></div></div><div className="summary-legend"><Legend color="#22a06b" label="Present" value={present}/><Legend color="#e65c5c" label="Absent" value={absent}/><Legend color="#f0a43c" label="Late" value={late}/><Legend color="#8a91a2" label="Excused" value={excused}/></div></div><div className="panel-footer"><span><span className="tiny-dot green-dot"/> {marked} of {selectedCount} students marked</span><button className="text-btn" onClick={() => setPage("Attendance")}>Continue marking <ArrowUpRight size={14}/></button></div></section>
              <section className="panel trend-panel"><div className="panel-head"><div><h2>Attendance activity</h2><p>Present records · last 7 days</p></div><span className="badge-neutral">7 days</span></div><div className="bar-chart">{last7.map((d, i) => <div className="bar-column" key={i}><div className="bar-wrap"><div className="bar" style={{height:`${Math.max(7, d.count / Math.max(1, selectedCount) * 100)}%`}} title={`${d.count} present`}/></div><span>{d.label}</span></div>)}</div><div className="chart-caption"><span>Weekly activity</span><strong>{last7.reduce((a,b)=>a+b.count,0)} attendance marks</strong></div></section>
            </div>
            <section className="panel roster-panel"><div className="panel-head"><div><h2>Recent attendance</h2><p>Latest status updates from your class</p></div><button className="btn-light" onClick={() => setPage("Attendance")}>See all <ArrowUpRight size={15}/></button></div><AttendanceTable students={classStudents.slice(0,5)} statusFor={statusFor} mark={mark} compact/></section>
            <div className="quick-actions"><button onClick={() => setPage("Students")}><span className="quick-icon violet"><Users/></span><span><strong>Add students</strong><small>Build your class roster</small></span><ArrowUpRight/></button><button onClick={() => setPage("QR Session")}><span className="quick-icon mint"><QrCode/></span><span><strong>Start QR session</strong><small>Let students check in</small></span><ArrowUpRight/></button><button onClick={exportExcel}><span className="quick-icon amber"><FileSpreadsheet/></span><span><strong>Export Excel</strong><small>Download attendance data</small></span><ArrowUpRight/></button></div>
          </>}

          {page === "Attendance" && <section className="panel full-panel"><div className="panel-head"><div><h2>Mark attendance</h2><p>Choose a date and update each student's status.</p></div><div className="inline-tools"><label className="date-field"><CalendarDays size={15}/><input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><button className="btn-light" onClick={markAllPresent}><Check size={15}/> Mark all present</button></div></div><AttendanceTable students={filteredStudents} statusFor={statusFor} mark={mark} removeStudent={removeStudent} showSearch search={search} setSearch={setSearch}/><div className="attendance-bottom"><span>{marked}/{selectedCount} marked for {date}</span><button className="btn-primary" onClick={exportExcel}><Download size={16}/> Save & export Excel</button></div></section>}

          {page === "Students" && <section className="panel full-panel"><div className="panel-head"><div><h2>Class roster</h2><p>{selectedCount} students · {selectedClass}</p></div><div className="inline-tools"><SearchBox value={search} onChange={setSearch}/><button className="btn-primary" onClick={() => setShowAdd(true)}><Plus size={16}/> Add student</button></div></div><div className="student-list"><table><thead><tr><th>STUDENT</th><th>ROLL NUMBER</th><th>CLASS</th><th>EMAIL</th><th></th></tr></thead><tbody>{filteredStudents.map(s=><tr key={s.id}><td><div className="student-cell"><div className="avatar">{initials(s.name)}</div><strong>{s.name}</strong></div></td><td><span className="roll-tag">{s.roll}</span></td><td>{s.className}</td><td>{s.email || "—"}</td><td><button className="icon-btn row-action" onClick={()=>removeStudent(s.id)} title="Remove student"><Trash2 size={15}/></button></td></tr>)}</tbody></table>{filteredStudents.length===0 && <EmptyState title="No students found" text="Try a different search or add a student."/>}</div></section>}

          {page === "QR Session" && <div className="qr-layout"><section className="panel qr-panel"><div className="panel-head"><div><h2>QR attendance session</h2><p>Students scan this code to submit their attendance.</p></div><span className="badge-neutral"><span className="tiny-dot green-dot"/> Session tool</span></div>{activeSession ? <div className="qr-active"><div className="qr-box"><QRCodeSVG value={sessionUrl} size={210} level="H" includeMargin/><span className="qr-logo"><GraduationCap size={17}/></span></div><h3>{activeSession.className}</h3><p>Scan to check in · Expires {new Date(activeSession.expiresAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p><div className="session-token"><span>Session ID</span><code>{activeSession.id.slice(0, 12)}…</code><button onClick={()=>{navigator.clipboard?.writeText(sessionUrl);showToast("Session link copied.");}}><Copy size={14}/></button></div><div className="qr-buttons"><button className="btn-light" onClick={()=>{setActiveSession(null);showToast("Session panel closed.");}}>Close panel</button><button className="btn-primary" onClick={createSession}><RefreshCw size={15}/> New QR session</button></div><div className="qr-warning"><ShieldCheck size={17}/><span>Demo QR session: identity is checked against this browser's roster. Use server-side validation before production.</span></div></div> : <div className="qr-empty"><div className="qr-empty-icon"><QrCode size={32}/></div><h3>Ready to take attendance?</h3><p>Create a QR session and display it on your classroom screen. Students can scan the code and check in.</p><button className="btn-primary" onClick={createSession}><QrCode size={16}/> Generate QR code</button></div>}</section><section className="panel qr-instructions"><div className="panel-head"><div><h2>How it works</h2><p>Three simple steps</p></div></div><div className="step-list"><Step n="01" title="Generate a QR code" text="Start a new attendance session for your selected class."/><Step n="02" title="Students scan" text="Students scan the QR code and enter their name and roll number."/><Step n="03" title="Review attendance" text="Check the class roster and correct any attendance status." /></div><div className="security-note"><ShieldCheck size={18}/><div><strong>Session safety</strong><p>QR sessions are intended to expire after 15 minutes. For real deployment, expiration and validation must be enforced by the database/server.</p></div></div></section>{activeSession && <section className="panel student-checkin"><div className="panel-head"><div><h2>Student check-in preview</h2><p>Test the check-in flow on this device.</p></div></div><div className="checkin-form"><label>Full name<input value={checkinName} onChange={e=>setCheckinName(e.target.value)} placeholder="Enter name exactly as roster"/></label><label>Roll number<input value={checkinRoll} onChange={e=>setCheckinRoll(e.target.value)} placeholder="e.g. CE-001"/></label><button className="btn-primary" onClick={submitCheckin}>Submit attendance</button></div></section>}</div>}

          {page === "Reports" && <><div className="stats-grid"><StatCard label="Total attendance marks" value={String(records.length)} sub="All dates and classes" icon={<ClipboardCheck/>} tone="blue"/><StatCard label="Present" value={String(records.filter(r=>r.status==="Present").length)} sub="Attendance records" icon={<CheckCircle2/>} tone="green"/><StatCard label="Absent" value={String(records.filter(r=>r.status==="Absent").length)} sub="Attendance records" icon={<XCircle/>} tone="orange"/><StatCard label="Excused" value={String(records.filter(r=>r.status==="Excused").length)} sub="Attendance records" icon={<Clock3/>} tone="purple"/></div><section className="panel full-panel"><div className="panel-head"><div><h2>Attendance report</h2><p>Export your class attendance to Excel.</p></div><button className="btn-primary" onClick={exportExcel}><Download size={16}/> Export Excel workbook</button></div><div className="report-note"><FileSpreadsheet size={28}/><div><strong>Smart Attendance Excel report</strong><p>Includes student roster, detailed attendance records, and class summary sheets.</p></div></div><div className="report-table"><table><thead><tr><th>CLASS</th><th>STUDENTS</th><th>ATTENDANCE RECORDS</th><th>PRESENT</th><th>ABSENT</th></tr></thead><tbody>{classes.map(c=>{const rs=records.filter(r=>r.className===c);return <tr key={c}><td>{c}</td><td>{students.filter(s=>s.className===c).length}</td><td>{rs.length}</td><td><span className="status present">{rs.filter(r=>r.status==="Present").length} present</span></td><td><span className="status absent">{rs.filter(r=>r.status==="Absent").length} absent</span></td></tr>})}</tbody></table></div></section></>}

          {page === "Settings" && <section className="panel full-panel settings-panel"><div className="panel-head"><div><h2>Workspace settings</h2><p>Manage your teacher workspace.</p></div></div><div className="setting-row"><div className="setting-icon"><UserRound/></div><div><strong>Teacher profile</strong><p>Teacher Demo · Individual teacher workspace</p></div><button className="btn-light" onClick={()=>showToast("Profile editing is planned for the cloud-auth phase.")}>Edit profile</button></div><div className="setting-row"><div className="setting-icon"><BookOpen/></div><div><strong>Default class</strong><p>Choose the class selected when opening the workspace.</p></div><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></div><div className="setting-row"><div className="setting-icon"><ShieldCheck/></div><div><strong>Cloud connection</strong><p>{cloudConfigured ? "Supabase project variables detected." : "Local demo data is saved in this browser. Cloud account setup is not active yet."}</p></div><span className={`status ${cloudConfigured?"present":"excused"}`}>{cloudConfigured?"Configured":"Demo mode"}</span></div><div className="setting-row"><div className="setting-icon"><Download/></div><div><strong>Export your data</strong><p>Download your attendance data as an Excel workbook.</p></div><button className="btn-primary" onClick={exportExcel}>Export Excel</button></div></section>}

          <footer className="footer"><span>© 2026 Attendly · Smart Attendance</span><span><span className="tiny-dot green-dot"/> All changes saved locally <span className="footer-divider">·</span> <button onClick={()=>showToast("This starter is in local demo mode until Supabase CRUD/Auth is connected.")}>Help & feedback</button></span></footer>
        </div>
      </main>

      {showAdd && <div className="modal-backdrop" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h2>Add a student</h2><p>Add a student to {selectedClass}.</p></div><button className="icon-btn" onClick={()=>setShowAdd(false)}><X/></button></div><label>Student name<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Alex Morgan"/></label><label>Roll number<input value={newRoll} onChange={e=>setNewRoll(e.target.value)} placeholder="e.g. CE-011"/></label><div className="modal-actions"><button className="btn-light" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn-primary" onClick={addStudent}><Plus size={15}/> Add student</button></div></div></div>}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
      {openCheckinFromUrl && page === "QR Session" && <div className="checkin-banner">You opened a QR check-in link. Enter your roster name and roll number below. <button onClick={()=>{history.replaceState({}, "", window.location.pathname);}}>Dismiss</button></div>}
    </div>
  );
}

function StatCard({label,value,sub,icon,tone,trend}:{label:string;value:string;sub:string;icon:React.ReactNode;tone:string;trend?:string}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-bottom"><span>{sub}</span>{trend&&<span className="stat-trend">{trend}</span>}</div></div>;
}
function Legend({color,label,value}:{color:string;label:string;value:number}) {return <div className="legend-row"><span className="legend-dot" style={{background:color}}/><span>{label}</span><strong>{value}</strong></div>}
function SearchBox({value,onChange}:{value:string;onChange:(v:string)=>void}) {return <label className="search-box"><Search size={15}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder="Search students..."/></label>}
function AttendanceTable({students,statusFor,mark,compact=false,showSearch=false,search="",setSearch,removeStudent}:{students:Student[];statusFor:(id:string)=>Status|undefined;mark:(id:string,status:Status)=>void;compact?:boolean;showSearch?:boolean;search?:string;setSearch?:(v:string)=>void;removeStudent?:(id:string)=>void}) {
  return <div className="attendance-table-wrap">{showSearch && setSearch && <div className="table-search"><SearchBox value={search} onChange={setSearch}/><span>{students.length} students</span></div>}<table className="attendance-table"><thead><tr><th>STUDENT</th><th>ROLL NUMBER</th><th>STATUS</th>{!compact&&<th>MARK ATTENDANCE</th>}{!compact&&<th></th>}</tr></thead><tbody>{students.map(s=>{const st=statusFor(s.id);return <tr key={s.id}><td><div className="student-cell"><div className="avatar">{initials(s.name)}</div><div><strong>{s.name}</strong>{!compact&&<small>{s.email||"Student"}</small>}</div></div></td><td><span className="roll-tag">{s.roll}</span></td><td>{st?<span className={`status ${statusClass(st)}`}><span className="status-dot-small"/>{st}</span>:<span className="status unmarked">Not marked</span>}</td>{!compact&&<td><div className="status-actions">{(["Present","Absent","Late","Excused"] as Status[]).map(x=><button key={x} className={`status-choice ${st===x?"selected "+statusClass(x):""}`} onClick={()=>mark(s.id,x)} title={x}>{x==="Present"?<Check size={13}/>:x==="Absent"?<X size={13}/>:x==="Late"?<Clock3 size={13}/>:<ShieldCheck size={13}/>}<span>{x}</span></button>)}</div></td>}{!compact&&<td>{removeStudent&&<button className="icon-btn row-action" title="Remove student" onClick={()=>removeStudent(s.id)}><Trash2 size={15}/></button>}</td>}</tr>})}</tbody></table>{students.length===0&&<EmptyState title="No students in this class" text="Add students to get started."/ >}</div>;
}
function EmptyState({title,text}:{title:string;text:string}) {return <div className="empty-state"><Users size={24}/><strong>{title}</strong><p>{text}</p></div>}
function Step({n,title,text}:{n:string;title:string;text:string}) {return <div className="step"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>}
