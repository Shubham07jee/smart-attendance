
import * as XLSX from "xlsx";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, ClipboardCheck, QrCode, FileSpreadsheet, Settings,
  Search, Bell, Plus, Download, ChevronDown, CalendarDays, CheckCircle2,
  Clock3, XCircle, MoreHorizontal, ArrowUpRight, Sparkles, Menu, Trash2,
  Copy, RefreshCw, ExternalLink, ShieldCheck, GraduationCap, X, Check,
  UserRound, BookOpen, CircleHelp, Eye, EyeOff
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cloudConfigured, supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

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

// Format dates in the user's local timezone (toISOString() can shift the day).
const toLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const today = toLocalDate(new Date());
const getStored = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
};
const saveStored = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const initials = (name: string) => name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
const statusClass = (s: Status) => s.toLowerCase();
const classes = ["Computer Engineering", "Mathematics", "Physics"];

function BrandLogo({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Smart Attendance logo"
    >
      <rect width="64" height="64" rx="15" fill="#0B1B3A" />

      {/* Graduation cap */}
      <path d="M7 21L32 9L57 21L32 33L7 21Z" fill="white" />
      <path
        d="M15 27V42C24 49 40 49 49 42V27L32 35L15 27Z"
        fill="white"
      />
      <path d="M54 22V34" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

      {/* Attendance check */}
      <circle cx="46" cy="46" r="13" fill="#0D75F5" />
      <path
        d="M40 46L44 50L52 41"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState("Overview");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [classIds, setClassIds] = useState<Record<string, string>>({});
  const [cloudLoading, setCloudLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>(() => getStored("sa_students", []));
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
  const [activeSessionToken, setActiveSessionToken] = useState("");
  const [checkinName, setCheckinName] = useState("");
  const [checkinRoll, setCheckinRoll] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState("");
  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profile, setProfile] = useState({ display_name: "", teacher_id: "", qualification: "", department: "", phone: "", avatar_url: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const checkinParams = new URLSearchParams(window.location.search);
  const checkinSessionId = checkinParams.get("checkin");
  const checkinToken = checkinParams.get("token");

  useEffect(() => { if (!authUser) saveStored("sa_students", students); }, [students, authUser]);
  useEffect(() => { if (!authUser) saveStored("sa_records", records); }, [records, authUser]);
  useEffect(() => saveStored("sa_sessions", sessions), [sessions]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setAuthUser(data.session?.user ?? null); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !authUser) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("teacher_profiles").select("display_name,teacher_id,qualification,department,phone,avatar_url").eq("id", authUser.id).maybeSingle();
      if (!cancelled && data) setProfile({ display_name: data.display_name || String(authUser.user_metadata?.display_name || "Teacher"), teacher_id: data.teacher_id || "", qualification: data.qualification || "", department: data.department || "", phone: data.phone || "", avatar_url: data.avatar_url || "" });
      else if (!cancelled) setProfile(p => ({ ...p, display_name: String(authUser.user_metadata?.display_name || authUser.email?.split("@")[0] || "Teacher") }));
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  useEffect(() => {
    if (!supabase || !authUser) {
      if (!authUser) {
        setStudents([]);
        setRecords([]);
        setClassIds({});
      }
      return;
    }
    const client = supabase;
    let cancelled = false;
    const loadCloudData = async () => {
      setCloudLoading(true);
      try {
        const existing = await client.from("classes").select("id,name").eq("teacher_id", authUser.id);
        if (existing.error) throw existing.error;
        const ids: Record<string, string> = Object.fromEntries((existing.data ?? []).map((row: any) => [row.name, row.id]));
        for (const className of classes) {
          if (!ids[className]) {
            const inserted = await client.from("classes").insert({ teacher_id: authUser.id, name: className }).select("id,name").single();
            if (inserted.error) throw inserted.error;
            ids[className] = inserted.data.id;
          }
        }
        const studentResult = await client.from("students").select("id,full_name,roll_number,email,class_id").eq("teacher_id", authUser.id);
        if (studentResult.error) throw studentResult.error;
        const attendanceResult = await client.from("attendance_records").select("id,student_id,class_id,attendance_date,status").eq("teacher_id", authUser.id);
        if (attendanceResult.error) throw attendanceResult.error;
        if (!cancelled) {
          setClassIds(ids);
          setStudents((studentResult.data ?? []).map((row: any) => ({ id: row.id, name: row.full_name, roll: row.roll_number, email: row.email ?? undefined, className: Object.keys(ids).find(name => ids[name] === row.class_id) ?? classes[0] })));
          setRecords((attendanceResult.data ?? []).map((row: any) => ({ studentId: row.student_id, date: row.attendance_date, status: row.status as Status, className: Object.keys(ids).find(name => ids[name] === row.class_id) ?? classes[0] })));
        }
      } catch (error: any) { if (!cancelled) showCloudError(error.message || "Unable to load cloud data."); }
      finally { if (!cancelled) setCloudLoading(false); }
    };
    void loadCloudData();
    return () => { cancelled = true; };
  }, [authUser]);

  const showCloudError = (message: string) => { setToast(`Cloud error: ${message}`); window.setTimeout(() => setToast(""), 5000); };

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

  const mark = async (studentId: string, status: Status) => {
    const entry = { studentId, date, status, className: selectedClass };
    if (authUser && supabase) {
      const classId = classIds[selectedClass];
      if (!classId) { showCloudError("Class is not ready yet. Please retry."); return; }
      const result = await supabase.from("attendance_records").upsert({ teacher_id: authUser.id, class_id: classId, student_id: studentId, attendance_date: date, status, source: "manual", updated_at: new Date().toISOString() }, { onConflict: "student_id,attendance_date,class_id" });
      if (result.error) { showCloudError(result.error.message); return; }
    }
    setRecords(prev => { const existing = prev.findIndex(r => r.studentId === studentId && r.date === date && r.className === selectedClass); if (existing >= 0) { const next = [...prev]; next[existing] = entry; return next; } return [...prev, entry]; });
  };

  const markAllPresent = async () => {
    const entries = classStudents.map(s => ({ studentId: s.id, date, status: "Present" as Status, className: selectedClass }));
    if (authUser && supabase) {
      const classId = classIds[selectedClass];
      const result = await supabase.from("attendance_records").upsert(entries.map(e => ({ teacher_id: authUser.id, class_id: classId, student_id: e.studentId, attendance_date: date, status: e.status, source: "manual" })), { onConflict: "student_id,attendance_date,class_id" });
      if (result.error) { showCloudError(result.error.message); return; }
    }
    setRecords(prev => [...prev.filter(r => !(r.date === date && r.className === selectedClass)), ...entries]); showToast("Everyone marked present.");
  };

  const addStudent = async () => {
    if (!newName.trim() || !newRoll.trim()) { showToast("Please enter both name and roll number."); return; }
    if (students.some(s => s.roll.toLowerCase() === newRoll.trim().toLowerCase() && s.className === selectedClass)) { showToast("This roll number already exists in the class."); return; }
    let student: Student = { id: crypto.randomUUID(), name: newName.trim(), roll: newRoll.trim(), className: selectedClass };
    if (authUser && supabase) {
      const classId = classIds[selectedClass];
      if (!classId) { showCloudError("Class is not ready yet. Please retry."); return; }
      const result = await supabase.from("students").insert({ teacher_id: authUser.id, class_id: classId, full_name: student.name, roll_number: student.roll }).select("id,full_name,roll_number,email").single();
      if (result.error) { showCloudError(result.error.message); return; }
      student = { ...student, id: result.data.id, email: result.data.email ?? undefined };
    }
    setStudents(prev => [...prev, student]); setNewName(""); setNewRoll(""); setShowAdd(false); showToast("Student added.");
  };

  const removeStudent = async (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student || !confirm(`Remove ${student.name} from this roster?`)) return;
    if (authUser && supabase) { const result = await supabase.from("students").delete().eq("id", id).eq("teacher_id", authUser.id); if (result.error) { showCloudError(result.error.message); return; } }
    setStudents(prev => prev.filter(s => s.id !== id)); setRecords(prev => prev.filter(r => r.studentId !== id)); showToast("Student removed.");
  };

  // Android: save the workbook to the app cache and open the native Share sheet.
  // Web: retain the normal browser download.
  const exportExcel = async () => {
    try {
      const roster = students.map(s => ({
        "Student name": s.name,
        "Roll number": s.roll,
        Class: s.className,
      }));

      const detail = records.map(r => {
        const s = students.find(st => st.id === r.studentId);
        return {
          Date: r.date,
          Class: r.className,
          "Student name": s?.name ?? "Removed student",
          "Roll number": s?.roll ?? "",
          Status: r.status,
        };
      });

      const summary = classes.map(c => {
        const rs = records.filter(r => r.className === c);
        return {
          Class: c,
          "Total students": students.filter(s => s.className === c).length,
          "Present records": rs.filter(r => r.status === "Present").length,
          "Absent records": rs.filter(r => r.status === "Absent").length,
          "Late records": rs.filter(r => r.status === "Late").length,
          "Excused records": rs.filter(r => r.status === "Excused").length,
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(roster), "Students");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Attendance");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");

      const filename = `Smart-Attendance-${date}.xlsx`;

      if (Capacitor.isNativePlatform()) {
        const base64 = XLSX.write(wb, {
          bookType: "xlsx",
          type: "base64",
        });

        const file = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: "Smart Attendance Excel Report",
          text: "Your attendance report is ready.",
          url: file.uri,
          dialogTitle: "Share attendance report",
        });

        showToast("Excel report is ready to share.");
      } else {
        XLSX.writeFile(wb, filename);
        showToast("Excel report downloaded.");
      }
    } catch (error: any) {
      console.error("Excel export failed:", error);
      showToast(error?.message || "Unable to export Excel report.");
    }
  };

  const createSession = async () => {
    if (!supabase || !authUser) {
      showToast("Please sign in to create a QR session.");
      return;
    }

    const classId = classIds[selectedClass];
    if (!classId) {
      showCloudError("Class is not ready yet. Please retry.");
      return;
    }

    try {
      // Keep the raw token only in memory and in the QR URL. Store only its hash.
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(randomBytes, byte => byte.toString(16).padStart(2, "0")).join("");
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const tokenHash = Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, "0")).join("");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("attendance_sessions")
        .insert({
          teacher_id: authUser.id,
          class_id: classId,
          session_date: today,
          token_hash: tokenHash,
          expires_at: expiresAt,
          active: true
        })
        .select("id, expires_at")
        .single();

      if (error) throw error;

      const session: Session = {
        id: data.id,
        className: selectedClass,
        createdAt: new Date().toISOString(),
        expiresAt: data.expires_at,
        active: true
      };

      setSessions(prev => [session, ...prev.map(item => ({ ...item, active: false }))]);
      setActiveSession(session);
      setActiveSessionToken(token);
      showToast("Secure QR session created. It expires in 15 minutes.");
    } catch (error: any) {
      showCloudError(error.message || "Unable to create QR session.");
    }
  };

  // Use the laptop's Wi-Fi IP for local QR testing.
  // Use the actual website domain when deployed.
  const appBaseUrl =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://192.168.1.7:5173"
      : window.location.origin;

  const sessionUrl = activeSession && activeSessionToken
    ? `${appBaseUrl}${window.location.pathname}?checkin=${encodeURIComponent(activeSession.id)}&token=${encodeURIComponent(activeSessionToken)}`
    : "";

  const submitCheckin = async () => {
    if (!supabase || !checkinSessionId || !checkinToken) {
      setCheckinSuccess(false);
      setCheckinMessage("This QR link is incomplete or invalid. Scan the latest QR code again.");
      return;
    }
    if (!checkinName.trim() || !checkinRoll.trim()) {
      setCheckinSuccess(false);
      setCheckinMessage("Enter both your full name and roll number.");
      return;
    }

    setCheckinBusy(true);
    setCheckinMessage("");
    try {
      const { data, error } = await supabase.rpc("submit_qr_attendance", {
        p_session_id: checkinSessionId,
        p_token: checkinToken,
        p_full_name: checkinName.trim(),
        p_roll_number: checkinRoll.trim()
      });
      if (error) throw error;

      const result = data as { success?: boolean; message?: string; student_name?: string } | null;
      setCheckinSuccess(Boolean(result?.success));
      setCheckinMessage(result?.message || "Unexpected response from attendance server.");
      if (result?.success) {
        setCheckinName("");
        setCheckinRoll("");
      }
    } catch (error: any) {
      setCheckinSuccess(false);
      setCheckinMessage(error.message || "Unable to submit attendance. Please try again.");
    } finally {
      setCheckinBusy(false);
    }
  };

  const navItems = [
    { name: "Overview", icon: LayoutDashboard }, { name: "Students", icon: Users },
    { name: "Attendance", icon: ClipboardCheck }, { name: "QR Session", icon: QrCode },
    { name: "Reports", icon: FileSpreadsheet }, { name: "Settings", icon: Settings },
  ];
  const selectedCount = classStudents.length;
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const iso = toLocalDate(d);
    const rs = records.filter(r => r.date === iso && r.className === selectedClass && r.status === "Present");
    return { label: d.toLocaleDateString("en", { weekday: "short" }), count: rs.length };
  }), [records, selectedClass]);

  if (checkinSessionId) {
    if (!supabase) {
      return <div className="auth-screen"><div className="auth-card"><h1>Smart Attendance</h1><p>Attendance check-in is unavailable because Supabase is not configured.</p></div></div>;
    }
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={event => { event.preventDefault(); void submitCheckin(); }}>
          <div className="auth-mark"><BrandLogo size={58} /></div>
          <h1>Student check-in</h1>
          <p>Enter your name and roll number exactly as registered with your teacher.</p>
          <label>Full name
            <input value={checkinName} onChange={event => setCheckinName(event.target.value)} placeholder="Enter your full name" autoComplete="name" required />
          </label>
          <label>Roll number
            <input value={checkinRoll} onChange={event => setCheckinRoll(event.target.value)} placeholder="e.g. CE-001" required />
          </label>
          <button className="btn-primary auth-submit" type="submit" disabled={checkinBusy || checkinSuccess}>
            {checkinBusy ? "Submitting…" : checkinSuccess ? "Attendance submitted" : "Submit attendance"}
          </button>
          {checkinMessage && <div className="auth-message">{checkinMessage}</div>}
          <small>This check-in link expires after 15 minutes. No teacher account is needed.</small>
        </form>
      </div>
    );
  }

  if (authLoading) return <div className="auth-screen"><div className="auth-card"><h1>Smart Attendance</h1><p>Checking your teacher account…</p></div></div>;
  if (!supabase) return <div className="auth-screen"><div className="auth-card"><h1>Supabase setup required</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file, then restart Vite.</p></div></div>;
  if (passwordRecovery) return <AuthScreen initialMode="reset" onPasswordUpdated={() => setPasswordRecovery(false)} />;
  if (!authUser) return <AuthScreen />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <BrandLogo size={42} />
          </div>
          <div className="brand-text">
            <strong>Smart Attendance</strong>
            <span>Track · Manage · Grow</span>
          </div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.name} className={`nav-item ${page === item.name ? "active" : ""}`} onClick={() => { setPage(item.name); setSidebarOpen(false); }}><Icon size={18}/><span>{item.name}</span>{item.name === "Attendance" && <span className="nav-count">{marked}</span>}</button>; })}</nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><div><strong>Need a hand?</strong><p>Quick guide to get started.</p><button onClick={() => setPage("Help")}>View guide <ArrowUpRight size={13}/></button></div></div><button className="profile profile-trigger" onClick={() => setProfileMenu(v => !v)}><div className="avatar teacher sidebar-profile-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="Teacher profile" /> : initials(profile.display_name || authUser.email || "T")}</div><div className="profile-text"><strong>{profile.display_name || authUser.email || "Teacher"}</strong><span>Teacher account · {selectedClass}</span></div><MoreHorizontal size={19} className="muted"/></button></div>
      </aside>

      <main className="main">
        <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="top-actions"><div className={`cloud-status ${cloudConfigured ? "connected" : ""}`}><span className="status-dot"/>{cloudConfigured ? "Cloud configured" : "Local demo mode"}</div><button className="icon-btn" title="Notifications" onClick={() => { setNotificationOpen(v => !v); setProfileMenu(false); }}><Bell size={18}/><i/></button><button className="btn-light" onClick={async()=>{await supabase?.auth.signOut();}}>Sign out</button><button className="avatar teacher small avatar-trigger" title="My profile" onClick={() => { setProfileMenu(v => !v); setNotificationOpen(false); }}>{profile.avatar_url ? <img src={profile.avatar_url} alt="Teacher profile"/> : initials(profile.display_name || authUser.email || "T")}</button></div></header>

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

          {page === "QR Session" && <div className="qr-layout"><section className="panel qr-panel"><div className="panel-head"><div><h2>QR attendance session</h2><p>Students scan this code to submit their attendance.</p></div><span className="badge-neutral"><span className="tiny-dot green-dot"/> Session tool</span></div>{activeSession ? <div className="qr-active"><div className="qr-box"><QRCodeSVG value={sessionUrl} size={210} level="H" includeMargin/><span className="qr-logo"><GraduationCap size={17}/></span></div><h3>{activeSession.className}</h3><p>Scan to check in · Expires {new Date(activeSession.expiresAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p><div className="session-token"><span>Session ID</span><code>{activeSession.id.slice(0, 12)}…</code><button onClick={()=>{navigator.clipboard?.writeText(sessionUrl);showToast("Session link copied.");}}><Copy size={14}/></button></div><div className="qr-buttons"><button className="btn-light" onClick={()=>{setActiveSession(null);showToast("Session panel closed.");}}>Close panel</button><button className="btn-primary" onClick={createSession}><RefreshCw size={15}/> New QR session</button></div><div className="qr-warning"><ShieldCheck size={17}/><span>Secure QR session: the database validates the session token, expiry, and student roster.</span></div></div> : <div className="qr-empty"><div className="qr-empty-icon"><QrCode size={32}/></div><h3>Ready to take attendance?</h3><p>Create a QR session and display it on your classroom screen. Students can scan the code and check in.</p><button className="btn-primary" onClick={createSession}><QrCode size={16}/> Generate QR code</button></div>}</section><section className="panel qr-instructions"><div className="panel-head"><div><h2>How it works</h2><p>Three simple steps</p></div></div><div className="step-list"><Step n="01" title="Generate a QR code" text="Start a new attendance session for your selected class."/><Step n="02" title="Students scan" text="Students scan the QR code and enter their name and roll number."/><Step n="03" title="Review attendance" text="Check the class roster and correct any attendance status." /></div><div className="security-note"><ShieldCheck size={18}/><div><strong>Session safety</strong><p>QR sessions are intended to expire after 15 minutes. For real deployment, expiration and validation must be enforced by the database/server.</p></div></div></section></div>}

          {page === "Reports" && <><div className="stats-grid"><StatCard label="Total attendance marks" value={String(records.length)} sub="All dates and classes" icon={<ClipboardCheck/>} tone="blue"/><StatCard label="Present" value={String(records.filter(r=>r.status==="Present").length)} sub="Attendance records" icon={<CheckCircle2/>} tone="green"/><StatCard label="Absent" value={String(records.filter(r=>r.status==="Absent").length)} sub="Attendance records" icon={<XCircle/>} tone="orange"/><StatCard label="Excused" value={String(records.filter(r=>r.status==="Excused").length)} sub="Attendance records" icon={<Clock3/>} tone="purple"/></div><section className="panel full-panel"><div className="panel-head"><div><h2>Attendance report</h2><p>Export your class attendance to Excel.</p></div><button className="btn-primary" onClick={exportExcel}><Download size={16}/> Export Excel workbook</button></div><div className="report-note"><FileSpreadsheet size={28}/><div><strong>Smart Attendance Excel report</strong><p>Includes student roster, detailed attendance records, and class summary sheets.</p></div></div><div className="report-table"><table><thead><tr><th>CLASS</th><th>STUDENTS</th><th>ATTENDANCE RECORDS</th><th>PRESENT</th><th>ABSENT</th></tr></thead><tbody>{classes.map(c=>{const rs=records.filter(r=>r.className===c);return <tr key={c}><td>{c}</td><td>{students.filter(s=>s.className===c).length}</td><td>{rs.length}</td><td><span className="status present">{rs.filter(r=>r.status==="Present").length} present</span></td><td><span className="status absent">{rs.filter(r=>r.status==="Absent").length} absent</span></td></tr>})}</tbody></table></div></section></>}

          {page === "Help" && <section className="panel full-panel"><div className="panel-head"><div><h2>Smart Attendance quick guide</h2><p>Essential steps for managing your classroom.</p></div></div><div className="step-list"><Step n="01" title="Set up your class" text="Choose your class from the selector and add students with their registered names and roll numbers."/><Step n="02" title="Take attendance" text="Open Attendance, choose the date, and mark each student Present, Absent, Late, or Excused."/><Step n="03" title="Use QR check-in" text="Open QR Session and generate a time-limited code. Students scan it and enter their roster details."/><Step n="04" title="Review and export" text="Use Reports to review attendance and download the Excel workbook."/><Step n="05" title="Manage your account" text="Use your profile menu to update teacher details and sign out securely."/></div><div className="security-note"><ShieldCheck size={18}/><div><strong>Need more help?</strong><p>For account or attendance issues, contact your project administrator. Never share your password or reset link.</p></div></div></section>}
          {page === "Settings" && <section className="panel full-panel settings-panel"><div className="panel-head"><div><h2>Workspace settings</h2><p>Manage your teacher workspace.</p></div></div><div className="setting-row"><div className="setting-icon"><UserRound/></div><div><strong>Teacher profile</strong><p>{authUser.email || "Teacher account"} · Individual teacher workspace</p></div><button className="btn-light" onClick={()=>setPage("My Profile")}>Edit profile</button></div><div className="setting-row"><div className="setting-icon"><BookOpen/></div><div><strong>Default class</strong><p>Choose the class selected when opening the workspace.</p></div><select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(c=><option key={c}>{c}</option>)}</select></div><div className="setting-row"><div className="setting-icon"><ShieldCheck/></div><div><strong>Cloud connection</strong><p>{cloudConfigured ? "Supabase is configured. Student and attendance data use your authenticated cloud account." : "Cloud configuration missing."}</p></div><span className={`status ${cloudConfigured?"present":"excused"}`}>{cloudConfigured?"Configured":"Demo mode"}</span></div><div className="setting-row"><div className="setting-icon"><Download/></div><div><strong>Export your data</strong><p>Download your attendance data as an Excel workbook.</p></div><button className="btn-primary" onClick={exportExcel}>Export Excel</button></div></section>}

          {page === "My Profile" && <section className="panel full-panel settings-panel"><div className="panel-head"><div><h2>Teacher profile</h2><p>Manage the details shown in your workspace.</p></div></div><form className="profile-form" onSubmit={async e => { e.preventDefault(); if (!supabase || !authUser) return; setProfileBusy(true); try { let avatar_url = profile.avatar_url; if (profilePhoto) { const path = `${authUser.id}/${Date.now()}-${profilePhoto.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`; const upload = await supabase.storage.from("teacher-avatars").upload(path, profilePhoto, { upsert: true, contentType: profilePhoto.type }); if (upload.error) throw upload.error; avatar_url = supabase.storage.from("teacher-avatars").getPublicUrl(path).data.publicUrl; } const { data: { user }, error: userError } = await supabase.auth.getUser();

if (userError) throw userError;

if (!user) {
  throw new Error("Your login session is not available. Please log in again.");
}

if (user.id !== authUser.id) {
  throw new Error("Your login session does not match the profile. Please log in again.");
}

const payload = {
  ...profile,
  id: user.id,
  avatar_url,
  updated_at: new Date().toISOString()
};

const saved = await supabase
  .from("teacher_profiles")
  .upsert(payload, { onConflict: "id" });

if (saved.error) throw saved.error; setProfile(p => ({...p, avatar_url})); setProfilePhoto(null); showToast("Teacher profile saved."); } catch (err: any) { showCloudError(err.message || "Could not save profile."); } finally { setProfileBusy(false); } }}><div className="profile-photo-row"><div className="avatar teacher profile-large">{profile.avatar_url ? <img src={profile.avatar_url} alt="Teacher"/> : initials(profile.display_name || authUser.email || "T")}</div><label>Upload profile photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setProfilePhoto(e.target.files?.[0] || null)}/><small>PNG, JPG or WebP · maximum 2 MB</small></label></div><div className="profile-fields"><label>Teacher name<input value={profile.display_name} onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))} required/></label><label>Teacher ID<input value={profile.teacher_id} onChange={e=>setProfile(p=>({...p,teacher_id:e.target.value}))} placeholder="Enter teacher ID"/></label><label>Department / Class<input value={profile.department} onChange={e=>setProfile(p=>({...p,department:e.target.value}))} placeholder={selectedClass}/></label><label>Qualifications<input value={profile.qualification} onChange={e=>setProfile(p=>({...p,qualification:e.target.value}))} placeholder="e.g. M.E., B.Ed."/></label><label>Phone number<input value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} placeholder="Optional"/></label><label>Email address<input value={authUser.email || ""} readOnly/></label></div><div className="modal-actions"><button type="button" className="btn-light" onClick={()=>setPage("Settings")}>Cancel</button><button className="btn-primary" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save profile"}</button></div></form></section>}
          <footer className="footer"><span>© 2026 Smart Attendance</span><span><span className="tiny-dot green-dot"/> {cloudLoading ? "Syncing cloud data…" : "Cloud data active"} <span className="footer-divider">·</span> <button onClick={()=>showToast("Teacher account and cloud database are active when signed in.")}>Help & feedback</button></span></footer>
        </div>
      </main>

      {profileMenu && <><button className="menu-dismiss" aria-label="Close profile menu" onClick={()=>setProfileMenu(false)}/><div className="account-menu"><div className="account-menu-head"><strong>{profile.display_name || "Teacher"}</strong><span>{authUser.email}</span><small>{profile.teacher_id ? `Teacher ID: ${profile.teacher_id}` : "Teacher account"} · {selectedClass}</small></div><button onClick={()=>{setPage("My Profile");setProfileMenu(false);}}> <UserRound size={15}/> My profile</button><button onClick={()=>{setPage("Settings");setProfileMenu(false);}}><Settings size={15}/> Settings</button><button onClick={async()=>{setProfileMenu(false);await supabase?.auth.signOut();}}><ExternalLink size={15}/> Sign out</button></div></>}
      {notificationOpen && <><button className="menu-dismiss" aria-label="Close notifications" onClick={()=>setNotificationOpen(false)}/><div className="notification-menu"><strong>Notifications</strong><p>No new notifications right now.</p><small>Attendance updates and account alerts will appear here.</small></div></>}
      {showAdd && <div className="modal-backdrop" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><h2>Add a student</h2><p>Add a student to {selectedClass}.</p></div><button className="icon-btn" onClick={()=>setShowAdd(false)}><X/></button></div><label>Student name<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Alex Morgan"/></label><label>Roll number<input value={newRoll} onChange={e=>setNewRoll(e.target.value)} placeholder="e.g. CE-011"/></label><div className="modal-actions"><button className="btn-light" onClick={()=>setShowAdd(false)}>Cancel</button><button className="btn-primary" onClick={addStudent}><Plus size={15}/> Add student</button></div></div></div>}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  );
}

function AuthScreen({ initialMode = "signin", onPasswordUpdated }: { initialMode?: "signin" | "signup" | "reset"; onPasswordUpdated?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const setNotice = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice("If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.");
      } else if (mode === "reset") {
        if (password.length < 6) throw new Error("Your new password must be at least 6 characters.");
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut();
        setPassword("");
        setConfirmPassword("");
        setMode("signin");
        onPasswordUpdated?.();
        setNotice("Your password has been updated. Sign in with your new password.");
      } else if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || "Teacher" } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created. Check your email for the confirmation link, then return here to sign in.");
        } else {
          setNotice("Account created successfully.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (error: any) {
      setNotice(error.message || "Authentication failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signup" ? "Create teacher account"
    : mode === "forgot" ? "Reset your password"
    : mode === "reset" ? "Choose a new password"
    : "Welcome back";
  const description = mode === "signup"
    ? "Create your secure teacher account to manage classes and attendance."
    : mode === "forgot"
    ? "Enter the email address linked to your account. We'll send you a password reset link."
    : mode === "reset"
    ? "Choose a new password for your teacher account."
    : "Sign in to securely manage your classes and attendance.";

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mark"><BrandLogo size={58} /></div>
        <h1>{title}</h1>
        <p>{description}</p>

        {mode === "signup" && (
          <label>Teacher name
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name"/>
          </label>
        )}

        {(mode === "signin" || mode === "signup" || mode === "forgot") && (
          <label>Email address
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teacher@example.com" required autoComplete="email"/>
          </label>
        )}

        {(mode === "signin" || mode === "signup" || mode === "reset") && (
          <label>{mode === "reset" ? "New password" : "Password"}
            <span className="auth-password-wrap">
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signin" ? "Enter your password" : "At least 6 characters"} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}/>
              <button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </span>
          </label>
        )}

        {(mode === "signup" || mode === "reset") && (
          <label>Confirm password
            <span className="auth-password-wrap">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required minLength={6} autoComplete="new-password"/>
              <button className="password-toggle" type="button" onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} title={showConfirmPassword ? "Hide password" : "Show password"}>
                {showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </span>
          </label>
        )}

        {mode === "signin" && (
          <div className="auth-forgot-row">
            <button type="button" onClick={() => { setMode("forgot"); setMessage(""); setPassword(""); }}>Forgot password?</button>
          </div>
        )}

        <button className="btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Update password"}
        </button>

        {message && <div className={`auth-message ${messageType === "error" ? "error" : "success"}`} role="status">{message}</div>}

        <div className="auth-switch">
          {mode === "reset" ? (
            <button type="button" onClick={() => { setMode("signin"); setMessage(""); onPasswordUpdated?.(); }}>Back to sign in</button>
          ) : mode === "forgot" ? (
            <>Remembered your password? <button type="button" onClick={() => { setMode("signin"); setMessage(""); }}>Back to sign in</button></>
          ) : (
            <>{mode === "signup" ? "Already have an account?" : "New to Smart Attendance?"} <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); setPassword(""); setConfirmPassword(""); }}>{mode === "signup" ? "Sign in" : "Create account"}</button></>
          )}
        </div>
        <small>Your data is scoped to your teacher account through database security policies.</small>
      </form>
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
