import { useState, useEffect, useRef, useCallback } from "react";
import {
  Image as ImageIcon, Mic, Trash2, Pencil, Check, X,
  Loader2, Sparkles, AlertCircle, Circle, CheckCircle2,
  User, Download, Copy, FolderPlus, Users, UserPlus, Settings, Lock, RefreshCw
} from "lucide-react";
import { SHEETS_URL } from "./config.js";

const MYNAME_KEY = "workhub_myname_v1";
const MY_AI_UNLOCKED_KEY = "workhub_my_ai_unlocked_v1";
const POLL_MS = 30000;

const FONT_BODY = "'Microsoft JhengHei', 'Microsoft JhengHei UI', 'PingFang TC', 'Noto Sans TC', -apple-system, sans-serif";
const FONT_MONO = "'Cascadia Code', 'SF Mono', 'Consolas', ui-monospace, monospace";

const C = {
  bg: "#0A0E14", bgElevated: "#111823", bgCard: "#151D2A", bgHover: "#1B2432",
  border: "#232C3D", borderSoft: "#1A2230",
  text: "#E8EDF4", textDim: "#8A97AC", textFaint: "#525C70",
  accent: "#4FD1C5", accentSoft: "rgba(79,209,197,0.13)",
  nextweek: "#8FD16F", nextweekSoft: "rgba(143,209,111,0.13)",
  warn: "#F0A868", warnSoft: "rgba(240,168,104,0.13)",
  danger: "#E5676B", dangerSoft: "rgba(229,103,107,0.13)",
  white: "#F2F5F9", whiteSoft: "rgba(242,245,249,0.10)",
};

const BUCKETS = [
  { id: "today", label: "今天", color: C.danger, soft: C.dangerSoft },
  { id: "week", label: "本週", color: C.warn, soft: C.warnSoft },
  { id: "later", label: "下週", color: C.nextweek, soft: C.nextweekSoft },
  { id: "waiting", label: "待追蹤", color: C.white, soft: C.whiteSoft },
];
const EXPORT_LABELS = { today: "今日", week: "本週", later: "下週", waiting: "待追蹤" };

function bucketMeta(id) { return BUCKETS.find(b => b.id === id) || BUCKETS[0]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtShort(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
function daysSince(iso) {
  if (!iso) return 0;
  const then = new Date(String(iso).slice(0, 10) + "T00:00:00");
  const now = new Date(todayISO() + "T00:00:00");
  return Math.max(0, Math.round((now - then) / 86400000));
}
function normalizeTask(t) {
  return { ...t, assignees: Array.isArray(t.assignees) ? t.assignees.filter(Boolean) : [] };
}

const CSS = `
  .wh-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .wh-scroll::-webkit-scrollbar-thumb { background: #2A3444; border-radius: 3px; }
  .wh-scroll::-webkit-scrollbar-track { background: transparent; }
  .wh-row { transition: background .12s ease; border-radius: 8px; }
  .wh-row:hover { background: ${C.bgHover}; }
  .wh-row:hover .wh-row-actions { opacity: 1; }
  .wh-row-actions { opacity: 0; transition: opacity .12s ease; }
  .wh-btn { transition: transform .1s ease, opacity .15s ease, background .15s ease; cursor: pointer; }
  .wh-btn:hover { opacity: 0.88; }
  .wh-btn:active { transform: scale(0.96); }
  .wh-check { transition: all .15s ease; cursor: pointer; }
  .wh-colrow { transition: background .12s ease; cursor: default; border-radius: 8px; }
  .wh-colrow:hover { background: ${C.bgHover}; }
  .wh-colrow:hover .wh-row-actions { opacity: 1; }
  @keyframes wh-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes wh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes wh-scan { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes wh-fadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  .wh-recording { animation: wh-pulse 1.1s ease-in-out infinite; }
  .wh-spin { animation: wh-spin 1s linear infinite; }
  .wh-scanning {
    background: linear-gradient(90deg, ${C.bgElevated} 0%, ${C.accentSoft} 50%, ${C.bgElevated} 100%);
    background-size: 200% 100%; animation: wh-scan 1.4s linear infinite;
  }
  .wh-fadein { animation: wh-fadein .18s ease; }
  .wh-input::placeholder, .wh-textarea::placeholder { color: ${C.textFaint}; }
  .wh-input:focus, .wh-textarea:focus, .wh-select:focus {
    outline: none; border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accentSoft};
  }
  .wh-select {
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%238A97AC'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center; background-size: 14px;
    padding-right: 26px !important; cursor: pointer;
  }
  .wh-date { color-scheme: dark; background: ${C.bgHover} !important; border: 1px solid ${C.accent} !important; cursor: pointer; }
  .wh-date::-webkit-calendar-picker-indicator {
    filter: invert(1); opacity: 1; cursor: pointer; width: 17px; height: 17px; padding: 4px; margin-left: 2px;
    background: ${C.accent}30; border-radius: 5px;
  }
  .wh-date::-webkit-calendar-picker-indicator:hover { background: ${C.accent}55; }
  .wh-date:hover { border-color: ${C.text} !important; }
  .wh-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 9px;
    border-radius: 999px; background: ${C.accentSoft}; color: ${C.accent}; font-size: 11.5px; white-space: nowrap;
  }
  .wh-chip button { display: flex; cursor: pointer; opacity: 0.75; }
  .wh-chip button:hover { opacity: 1; }
  .wh-box { display: flex; flex-direction: column; background: ${C.bgCard}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden; }
  .wh-dashboard { display: flex; gap: 12px; align-items: flex-start; }
  .wh-boxgrid { flex: 1 1 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; min-width: 0; }
  .wh-sidepanel { flex: 0 0 270px; }
  @media (max-width: 940px) {
    .wh-dashboard { flex-direction: column; }
    .wh-boxgrid { grid-template-columns: 1fr; width: 100%; }
    .wh-sidepanel { flex: 1 1 auto; width: 100%; }
  }
  body { background: ${C.bg}; }
`;

function IconBtn({ onClick, title, children, active, color, disabled }) {
  return (
    <button type="button" className="wh-btn" onClick={onClick} title={title} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        border: `1px solid ${active ? (color || C.accent) : C.border}`,
        background: active ? (color ? color + "22" : C.accentSoft) : "transparent",
        color: active ? (color || C.accent) : C.textDim,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
      }}>
      {children}
    </button>
  );
}
function Badge({ text, color, soft }) {
  return (
    <span style={{ fontFamily: FONT_MONO, fontSize: 11, padding: "2px 7px", borderRadius: 999, background: soft, color, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{text}</span>
  );
}
function AssigneeChips({ names, onRemove, colleagues, draft, setDraft, onAdd }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 7px" }}>
      {names.map(n => (
        <span key={n} className="wh-chip">{n}<button type="button" onClick={() => onRemove(n)}><X size={11} /></button></span>
      ))}
      <input list="wh-colleague-list" value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === "," || e.key === "、") { e.preventDefault(); onAdd(); }
          else if (e.key === "Backspace" && draft === "" && names.length > 0) onRemove(names[names.length - 1]);
        }}
        onBlur={() => { if (draft.trim()) onAdd(); }}
        placeholder={names.length ? "" : "負責人，可多個…"}
        style={{ flex: "1 1 70px", minWidth: 60, background: "transparent", border: "none", color: C.text, fontSize: 12.5, fontFamily: FONT_BODY, outline: "none" }} />
      <datalist id="wh-colleague-list">{colleagues.map(c => <option key={c} value={c} />)}</datalist>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [projectList, setProjectList] = useState([]);
  const [colleagueList, setColleagueList] = useState([]);
  const [myName, setMyName] = useState(() => localStorage.getItem(MYNAME_KEY) || "");
  const [myNameDraft, setMyNameDraft] = useState("");
  const [editingMyName, setEditingMyName] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [captureText, setCaptureText] = useState("");
  const [captureImage, setCaptureImage] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [quickAdd, setQuickAdd] = useState({ title: "", project: "", assignees: [], bucket: "today", due_date: "", follow_up_date: "" });
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editAssigneeDraft, setEditAssigneeDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newColleagueName, setNewColleagueName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [aiUnlockCode, setAiUnlockCode] = useState("");
  const [myAiUnlocked, setMyAiUnlocked] = useState(() => localStorage.getItem(MY_AI_UNLOCKED_KEY) === "true");
  const [codeDraft, setCodeDraft] = useState("");
  const [newCodeDraft, setNewCodeDraft] = useState("");
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const toastTimerRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 2200);
  }

  const fetchAll = useCallback(async (silent) => {
    if (!SHEETS_URL) { setConnectionError("尚未設定 VITE_SHEETS_URL，請參考 README 設定 Google Sheets 連線。"); setLoaded(true); return; }
    if (!silent) setSyncing(true);
    try {
      const res = await fetch(SHEETS_URL + "?action=all");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setTasks((data.tasks || []).map(normalizeTask));
      setProjectList(data.projects || []);
      setColleagueList(data.colleagues || []);
      setAiUnlockCode((data.settings && data.settings.ai_unlock_code) || "");
      setConnectionError("");
    } catch (e) {
      setConnectionError("無法連線到 Google Sheets，請確認網址與部署設定是否正確（詳見 README）。");
    } finally {
      setSyncing(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
    const t = setInterval(() => fetchAll(true), POLL_MS);
    return () => clearInterval(t);
  }, [fetchAll]);

  async function postAction(body) {
    if (!SHEETS_URL) return;
    try {
      await fetch(SHEETS_URL, { method: "POST", body: JSON.stringify(body) });
    } catch (e) {
      showToast("同步失敗，稍後會自動重試");
    }
  }

  function confirmMyName() {
    const clean = myNameDraft.trim();
    if (!clean) return;
    setMyName(clean);
    localStorage.setItem(MYNAME_KEY, clean);
    setEditingMyName(false);
  }

  function submitUnlockCode() {
    const clean = codeDraft.trim();
    if (!clean) return;
    if (aiUnlockCode && clean === aiUnlockCode) {
      setMyAiUnlocked(true);
      localStorage.setItem(MY_AI_UNLOCKED_KEY, "true");
      setCodeDraft("");
      showToast("AI 功能已開通");
    } else {
      showToast("啟用碼不正確");
    }
  }
  function adminSetCode() {
    const clean = newCodeDraft.trim();
    if (!clean) return;
    setAiUnlockCode(clean);
    setNewCodeDraft("");
    showToast("已更新啟用碼");
    postAction({ action: "setSetting", key: "ai_unlock_code", value: clean });
  }

  const projects = Array.from(new Set([...projectList, ...tasks.map(t => t.project).filter(Boolean)])).sort();
  const colleagues = Array.from(new Set([...colleagueList, ...tasks.flatMap(t => t.assignees)])).filter(c => c && c !== myName).sort();
  const assigneeSuggestions = myName ? [myName, ...colleagues] : colleagues;
  const visibleTasks = myName
    ? tasks.filter(t => t.assignees.length === 0 || t.assignees.includes(myName) || t.created_by === myName)
    : tasks;

  function addProject(name) {
    const clean = name.trim();
    if (!clean) return;
    if (projectList.includes(clean)) { showToast(`「${clean}」已經存在`); return; }
    setProjectList(prev => [...prev, clean]);
    setNewProjectName("");
    showToast(`已新增專案「${clean}」`);
    postAction({ action: "addProject", name: clean });
  }
  function removeProject(name) {
    const hasTasks = tasks.some(t => t.project === name);
    if (hasTasks) { showToast("這個專案還有工作，無法移除"); return; }
    if (!confirm(`移除專案「${name}」？`)) return;
    setProjectList(prev => prev.filter(p => p !== name));
    postAction({ action: "removeProject", name });
  }
  function addColleague(name) {
    const clean = name.trim();
    if (!clean) return;
    if (clean === myName) { showToast("這是你自己"); return; }
    if (colleagueList.includes(clean)) { showToast(`「${clean}」已經存在`); return; }
    setColleagueList(prev => [...prev, clean]);
    setNewColleagueName("");
    showToast(`已新增同仁「${clean}」`);
    postAction({ action: "addColleague", name: clean });
  }
  function removeColleague(name) {
    const hasTasks = tasks.some(t => t.assignees.includes(name));
    if (hasTasks) { showToast("這位同仁還有共同負責的工作，無法移除"); return; }
    setColleagueList(prev => prev.filter(c => c !== name));
    postAction({ action: "removeColleague", name });
  }
  function collabCount(colleague) {
    if (!myName) return 0;
    return tasks.filter(t => !t.done && t.assignees.includes(myName) && t.assignees.includes(colleague)).length;
  }

  function addTasks(list) {
    const now = new Date().toISOString();
    const newOnes = list.map(t => ({
      id: uid(), title: t.title, project: (t.project || "").trim() || "未分類",
      assignees: Array.isArray(t.assignees) ? t.assignees.filter(Boolean) : [],
      bucket: t.bucket || "later", due_date: t.due_date || null, follow_up_date: t.follow_up_date || null,
      notes: t.notes || "", confidence: t.confidence || null, done: false,
      created_at: now, completed_at: null, source: t.source || "manual", created_by: myName || "",
    }));
    setTasks(prev => [...prev, ...newOnes]);
    newOnes.forEach(t => postAction({ action: "addTask", task: t }));
  }
  function toggleDone(id) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const done = !t.done;
      const completed_at = done ? new Date().toISOString() : null;
      postAction({ action: "updateTask", id, patch: { done, completed_at } });
      return { ...t, done, completed_at };
    }));
  }
  function deleteTask(id) {
    if (!confirm("刪除這項工作？")) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    postAction({ action: "deleteTask", id });
  }
  function startEdit(t) { setEditingId(t.id); setEditDraft({ ...t }); setEditAssigneeDraft(""); }
  function saveEdit() {
    const patch = {
      title: editDraft.title, project: (editDraft.project || "").trim() || "未分類",
      assignees: editDraft.assignees || [], bucket: editDraft.bucket,
      due_date: editDraft.due_date || null, follow_up_date: editDraft.follow_up_date || null, notes: editDraft.notes || "",
    };
    setTasks(prev => prev.map(t => t.id === editingId ? { ...t, ...patch } : t));
    postAction({ action: "updateTask", id: editingId, patch });
    setEditingId(null); setEditDraft(null);
  }

  function handleFile(e) { const file = e.target.files[0]; if (!file) return; readImageFile(file); e.target.value = ""; }
  function readImageFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setCaptureImage({ base64, mediaType: file.type || "image/png", previewUrl: reader.result, name: file.name });
    };
    reader.readAsDataURL(file);
  }
  function handlePaste(e) {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { readImageFile(file); e.preventDefault(); break; }
      }
    }
  }

  function toggleRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("此瀏覽器不支援語音輸入，建議改用 Chrome。"); return; }
    if (recording) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "zh-TW"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (ev) => {
      let chunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) chunk += ev.results[i][0].transcript;
      if (chunk) setQuickAdd(q => ({ ...q, title: (q.title ? q.title + " " : "") + chunk }));
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recognitionRef.current = rec; rec.start(); setRecording(true);
  }

  async function runAIExtract() {
    if (!captureImage) return;
    setParsing(true); setError("");
    try {
      const today = todayISO();
      const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: captureImage.base64, imageMediaType: captureImage.mediaType,
          noteText: captureText.trim(), todayStr: today, weekday,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 解析失敗");
      const list = data.tasks || [];
      if (list.length === 0) {
        setError("沒有從這段內容找到明確的工作項目，可以試著補充更多細節，或改用下方手動新增。");
        setPending(null);
      } else {
        setPending(list.map(p => ({ ...p, assignees: Array.isArray(p.assignees) ? p.assignees : [], _id: uid(), include: true })));
      }
    } catch (e) {
      console.error(e);
      setError("AI 解析失敗：" + (e.message || "請稍後再試"));
    } finally {
      setParsing(false);
    }
  }

  function confirmPending() {
    const chosen = pending.filter(p => p.include);
    addTasks(chosen.map(p => ({ ...p, source: "ai-image" })));
    if (chosen.length > 0) showToast(`已加入 ${chosen.length} 項工作`);
    setPending(null); setCaptureText(""); setCaptureImage(null);
  }
  function cancelPending() { setPending(null); }
  function updatePendingRow(id, patch) { setPending(prev => prev.map(p => p._id === id ? { ...p, ...patch } : p)); }

  function submitQuickAdd() {
    const title = quickAdd.title.trim();
    if (!title) return;
    addTasks([{ ...quickAdd, title, source: "manual" }]);
    showToast(`已加入「${title}」`);
    setQuickAdd(q => ({ ...q, title: "", due_date: "", follow_up_date: "" }));
  }

  function buildExportText() {
    const active = visibleTasks.filter(t => !t.done);
    const projOrder = Array.from(new Set([...projectList, ...active.map(t => t.project)])).filter(p => active.some(t => t.project === p));
    const lines = [];
    projOrder.forEach((proj, idx) => {
      if (idx > 0) lines.push("");
      lines.push(`${proj}工作事項`);
      BUCKETS.forEach(b => {
        const items = active.filter(t => t.project === proj && t.bucket === b.id);
        if (items.length === 0) return;
        lines.push(""); lines.push(EXPORT_LABELS[b.id]);
        items.forEach((t, i) => {
          let extra = [];
          if (t.due_date) extra.push(fmtShort(t.due_date));
          if (t.assignees.length) extra.push(t.assignees.join("、"));
          lines.push(`${i + 1}. ${t.title}${extra.length ? `（${extra.join("，")}）` : ""}`);
        });
      });
    });
    return lines.join("\n");
  }
  async function copyExport() {
    const text = buildExportText();
    try { await navigator.clipboard.writeText(text); showToast("已複製到剪貼簿"); }
    catch (e) { showToast("複製失敗，請手動選取文字複製"); }
  }
  function downloadExport() {
    const text = buildExportText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `工作事項_${todayISO()}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function renderTaskRow(t) {
    const overdue = t.bucket === "today" && !t.done && t.due_date && t.due_date < todayISO();
    if (editingId === t.id) {
      return (
        <div key={t.id} className="wh-fadein" style={{ padding: 10, borderRadius: 10, background: C.bgElevated, border: `1px solid ${C.accent}`, display: "flex", flexDirection: "column", gap: 7, marginBottom: 6 }}>
          <input className="wh-input" value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} style={inputStyle()} placeholder="工作標題" />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input className="wh-input" value={editDraft.project} onChange={e => setEditDraft(d => ({ ...d, project: e.target.value }))} style={{ ...inputStyle(), flex: "1 1 100px" }} placeholder="專案" />
            <select className="wh-select" value={editDraft.bucket} onChange={e => setEditDraft(d => ({ ...d, bucket: e.target.value }))} style={{ ...inputStyle(), flex: "1 1 80px" }}>
              {BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <AssigneeChips names={editDraft.assignees || []} colleagues={assigneeSuggestions} draft={editAssigneeDraft} setDraft={setEditAssigneeDraft}
            onRemove={n => setEditDraft(d => ({ ...d, assignees: d.assignees.filter(x => x !== n) }))}
            onAdd={() => { const clean = editAssigneeDraft.replace(/[,、]/g, "").trim(); if (clean && !editDraft.assignees.includes(clean)) setEditDraft(d => ({ ...d, assignees: [...d.assignees, clean] })); setEditAssigneeDraft(""); }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={labelStyle()}>期限
              <input type="date" className="wh-input wh-date" value={(editDraft.due_date || "").slice(0, 10)} onChange={e => setEditDraft(d => ({ ...d, due_date: e.target.value }))} style={inputStyle()} />
            </label>
            {editDraft.bucket === "waiting" && (
              <label style={labelStyle()}>追蹤日
                <input type="date" className="wh-input wh-date" value={(editDraft.follow_up_date || "").slice(0, 10)} onChange={e => setEditDraft(d => ({ ...d, follow_up_date: e.target.value }))} style={inputStyle()} />
              </label>
            )}
          </div>
          <textarea className="wh-textarea" value={editDraft.notes} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} placeholder="備註（選填）" rows={2} style={{ ...inputStyle(), resize: "vertical", fontFamily: FONT_BODY }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="wh-btn" onClick={() => setEditingId(null)} style={ghostBtnStyle()}>取消</button>
            <button className="wh-btn" onClick={saveEdit} style={primaryBtnStyle()}>儲存</button>
          </div>
        </div>
      );
    }
    return (
      <div key={t.id} className="wh-row" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 6px" }}>
        <div className="wh-check" onClick={() => toggleDone(t.id)} style={{ marginTop: 2 }}>
          {t.done ? <CheckCircle2 size={17} color={C.accent} /> : <Circle size={17} color={overdue ? C.danger : C.textFaint} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.4, color: t.done ? C.textFaint : C.text, textDecoration: t.done ? "line-through" : "none", wordBreak: "break-word" }}>{t.title}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
            <Badge text={t.project} color={C.textDim} soft={C.bgElevated} />
            {t.assignees.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: C.textDim }}><User size={10} />{t.assignees.join("、")}</span>
            )}
            {myName && t.assignees.length > 0 && !t.assignees.includes(myName) && t.created_by === myName && (
              <Badge text="已指派" color={C.textDim} soft={C.bgElevated} />
            )}
            {t.due_date && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: overdue ? C.danger : C.textDim }}>{overdue ? "逾期 " : ""}{fmtShort(t.due_date)}</span>
            )}
            {t.bucket === "waiting" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.warn }}>已等待 {daysSince(t.created_at)} 天</span>
            )}
            {t.bucket === "waiting" && t.follow_up_date && t.follow_up_date <= todayISO() && (
              <Badge text="該追蹤了" color={C.warn} soft={C.warnSoft} />
            )}
          </div>
        </div>
        <div className="wh-row-actions" style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          <IconBtn onClick={() => startEdit(t)} title="編輯"><Pencil size={12} /></IconBtn>
          <IconBtn onClick={() => deleteTask(t.id)} title="刪除" color={C.danger}><Trash2 size={12} /></IconBtn>
        </div>
      </div>
    );
  }

  function renderBox(bucket) {
    let list = visibleTasks.filter(t => t.bucket === bucket.id);
    if (!showDone) list = list.filter(t => !t.done);
    list.sort((a, b) => (a.due_date || a.follow_up_date || "9999").localeCompare(b.due_date || b.follow_up_date || "9999"));
    return (
      <div key={bucket.id} className="wh-box" style={{ minHeight: 240, maxHeight: 460, border: `1.5px solid ${bucket.color}55` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: `1.5px solid ${bucket.color}55`, background: bucket.soft }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: bucket.color }}>{bucket.label}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: bucket.color, opacity: 0.85 }}>{list.length}</span>
        </div>
        <div className="wh-scroll" style={{ padding: "4px 8px", overflowY: "auto", flex: 1 }}>
          {list.length === 0 ? <div style={{ ...emptyStyle(), padding: "24px 8px" }}>沒有工作</div> : list.map(renderTaskRow)}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div style={{ fontFamily: FONT_BODY, color: C.textDim, padding: 40, textAlign: "center" }}>載入中…</div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        fontFamily: FONT_BODY, background: `linear-gradient(180deg, ${C.bg} 0%, #0C121C 100%)`, color: C.text,
        borderRadius: 18, border: `1px solid ${C.border}`, maxWidth: 1180, margin: "24px auto",
        padding: "18px 18px 22px", position: "relative", boxSizing: "border-box", boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.2 }}>我的工作台</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.textFaint, marginTop: 2, letterSpacing: 0.5 }}>AI WORK HUB · {todayISO()}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconBtn onClick={() => fetchAll(false)} title="手動重新整理" active={syncing}>
              <span className={syncing ? "wh-spin" : ""}><RefreshCw size={14} /></span>
            </IconBtn>
            {editingMyName ? (
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input autoFocus className="wh-input" value={myNameDraft} onChange={e => setMyNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") confirmMyName(); }} placeholder="你的名字"
                  style={{ ...inputStyle(), width: 100, fontFamily: FONT_BODY }} />
                <IconBtn onClick={confirmMyName} title="確認"><Check size={13} /></IconBtn>
              </div>
            ) : (
              <span onClick={() => { setEditingMyName(true); setMyNameDraft(myName); }} style={{ fontSize: 12, color: C.textDim, cursor: "pointer" }} title="點擊更換身分">
                你是：<b style={{ color: C.text }}>{myName || "未設定"}</b>
              </span>
            )}
            <IconBtn onClick={() => setShowSettings(true)} title="設定（工作同仁 / AI 啟用碼）"><Settings size={15} /></IconBtn>
          </div>
        </div>

        {connectionError && (
          <div className="wh-fadein" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, background: C.dangerSoft, color: C.danger, fontSize: 12.5, marginBottom: 12 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{connectionError}</span>
          </div>
        )}

        {!myName && !editingMyName && (
          <div className="wh-fadein" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: C.warnSoft, color: C.warn, fontSize: 12.5, marginBottom: 12, flexWrap: "wrap" }}>
            <AlertCircle size={14} />
            <span>還沒設定你的名字，工作台會用它判斷哪些工作是你的（在還沒設定前，會顯示所有人的工作）。</span>
            <button className="wh-btn" onClick={() => { setEditingMyName(true); setMyNameDraft(""); }} style={{ ...ghostBtnStyle(), marginLeft: "auto" }}>設定名字</button>
          </div>
        )}

        {toast && (
          <div className="wh-fadein" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, background: C.accentSoft, color: C.accent, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
            <Check size={14} /> {toast}
          </div>
        )}

        <div className="wh-dashboard" style={{ marginBottom: 12 }}>
          <div className="wh-boxgrid">{BUCKETS.map(renderBox)}</div>
          <div className="wh-sidepanel">
            <div className="wh-box" style={{ padding: 10, maxHeight: 480 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.textDim }}>所有專案（匯出格式）</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <IconBtn onClick={copyExport} title="複製到剪貼簿"><Copy size={13} /></IconBtn>
                  <IconBtn onClick={downloadExport} title="下載 .txt"><Download size={13} /></IconBtn>
                </div>
              </div>
              <pre className="wh-scroll" style={{ margin: 0, fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 380, overflowY: "auto" }}>
                {buildExportText() || "目前沒有進行中的工作。"}
              </pre>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input className="wh-input" placeholder="新增專案名稱…" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addProject(newProjectName); } }} style={{ ...inputStyle(), flex: 1, fontSize: 12 }} />
                <IconBtn onClick={() => addProject(newProjectName)} title="建立空專案"><FolderPlus size={13} /></IconBtn>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <button className="wh-btn" onClick={() => setShowDone(s => !s)} style={ghostBtnStyle()}>{showDone ? "隱藏已完成" : "顯示已完成"}</button>
        </div>

        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input className="wh-input" placeholder="輸入工作標題…" value={quickAdd.title} onChange={e => setQuickAdd(q => ({ ...q, title: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitQuickAdd(); } }} style={{ ...inputStyle(), flex: 1, fontFamily: FONT_BODY, fontSize: 14 }} />
            <IconBtn onClick={toggleRecording} title="語音輸入（唸出來自動填標題）" active={recording} color={C.danger}>
              <span className={recording ? "wh-recording" : ""}><Mic size={15} /></span>
            </IconBtn>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input className="wh-input" placeholder="專案" list="wh-project-list" value={quickAdd.project} onChange={e => setQuickAdd(q => ({ ...q, project: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitQuickAdd(); } }} style={{ ...inputStyle(), flex: "1 1 110px" }} />
            <datalist id="wh-project-list">{projects.map(p => <option key={p} value={p} />)}</datalist>
            <select className="wh-select" value={quickAdd.bucket} onChange={e => setQuickAdd(q => ({ ...q, bucket: e.target.value }))} style={{ ...inputStyle(), flex: "1 1 80px" }}>
              {BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <div style={{ flex: "1 1 160px" }}>
              <AssigneeChips names={quickAdd.assignees} colleagues={assigneeSuggestions} draft={assigneeDraft} setDraft={setAssigneeDraft}
                onRemove={n => setQuickAdd(q => ({ ...q, assignees: q.assignees.filter(x => x !== n) }))}
                onAdd={() => { const clean = assigneeDraft.replace(/[,、]/g, "").trim(); if (clean && !quickAdd.assignees.includes(clean)) setQuickAdd(q => ({ ...q, assignees: [...q.assignees, clean] })); setAssigneeDraft(""); }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={labelStyle()}>期限
              <input type="date" className="wh-input wh-date" value={quickAdd.due_date} onChange={e => setQuickAdd(q => ({ ...q, due_date: e.target.value }))} style={inputStyle()} />
            </label>
            {quickAdd.bucket === "waiting" && (
              <label style={labelStyle()}>追蹤日
                <input type="date" className="wh-input wh-date" value={quickAdd.follow_up_date} onChange={e => setQuickAdd(q => ({ ...q, follow_up_date: e.target.value }))} style={inputStyle()} />
              </label>
            )}
            <button type="button" className="wh-btn" onClick={submitQuickAdd} style={{ ...primaryBtnStyle(), flex: "0 0 auto", marginLeft: "auto" }}>加入</button>
          </div>
        </div>

        {myAiUnlocked ? (
          <div style={{ background: C.bgElevated, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Sparkles size={13} color={C.textDim} />
              <span style={{ fontSize: 11.5, color: C.textDim, fontWeight: 600, letterSpacing: 0.3 }}>截圖分析（AI）· 只有附上圖片才會呼叫 AI</span>
            </div>
            <div onPaste={handlePaste} style={{ border: `1px dashed ${captureImage ? C.accent : C.border}`, borderRadius: 9, padding: 8, display: "flex", alignItems: "center", gap: 8, cursor: "text" }}>
              {captureImage ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <img src={captureImage.previewUrl} alt="附加截圖" style={{ height: 40, borderRadius: 6, border: `1px solid ${C.border}` }} />
                  <span style={{ fontSize: 11.5, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{captureImage.name}</span>
                  <IconBtn onClick={() => setCaptureImage(null)} title="移除圖片" color={C.danger}><X size={13} /></IconBtn>
                </div>
              ) : (
                <span style={{ fontSize: 12.5, color: C.textFaint, flex: 1 }}>把截圖貼在這裡（Ctrl+V），或點右側圖示上傳…</span>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              <IconBtn onClick={() => fileInputRef.current?.click()} title="上傳截圖"><ImageIcon size={15} /></IconBtn>
            </div>
            {captureImage && (
              <input className="wh-input" value={captureText} onChange={e => setCaptureText(e.target.value)} placeholder="補充說明（選填），例如：這是老闆傳的訊息" style={{ ...inputStyle(), fontFamily: FONT_BODY, marginTop: 8 }} />
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button className="wh-btn" onClick={runAIExtract} disabled={parsing || !captureImage}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: C.accent, color: "#062622", fontWeight: 700, fontSize: 13, border: "none", cursor: parsing ? "wait" : (!captureImage ? "not-allowed" : "pointer"), opacity: (!captureImage && !parsing) ? 0.4 : 1 }}>
                {parsing ? <Loader2 size={14} className="wh-recording" /> : <Sparkles size={14} />}
                {parsing ? "AI 解析中" : "AI 解析截圖"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: C.bgElevated, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Lock size={13} color={C.textFaint} />
              <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>截圖分析（AI）· 付費功能</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.textFaint, marginBottom: 8, lineHeight: 1.5 }}>
              沒有輸入啟用碼的話，這裡只是一個簡易的工作事項紀錄器（可以連動到所有同仁），不會使用 AI。有啟用碼的話輸入即可開通。
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="wh-input" placeholder="輸入啟用碼" value={codeDraft} onChange={e => setCodeDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitUnlockCode(); } }} style={{ ...inputStyle(), flex: 1 }} />
              <button className="wh-btn" onClick={submitUnlockCode} style={primaryBtnStyle()}>開通</button>
            </div>
          </div>
        )}

        {error && (
          <div className="wh-fadein" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 10, borderRadius: 10, background: C.warnSoft, color: C.warn, fontSize: 12.5, marginBottom: 12 }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /><span>{error}</span>
            <span style={{ marginLeft: "auto", cursor: "pointer" }} onClick={() => setError("")}><X size={14} /></span>
          </div>
        )}
        {parsing && (
          <div className="wh-scanning" style={{ borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 12.5, color: C.textDim, fontFamily: FONT_MONO }}>正在讀取內容、判斷工作、日期與分類…</div>
        )}
        {pending && (
          <div className="wh-fadein" style={{ border: `1px solid ${C.accent}`, borderRadius: 12, padding: 12, marginBottom: 14, background: C.bgCard }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.accent }}>找到 {pending.length} 件工作，確認後加入</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pending.map(p => (
                <div key={p._id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 8, borderRadius: 8, background: p.include ? C.bgElevated : "transparent", border: `1px solid ${p.include ? C.borderSoft : "transparent"}`, opacity: p.include ? 1 : 0.45 }}>
                  <div className="wh-check" onClick={() => updatePendingRow(p._id, { include: !p.include })} style={{ marginTop: 3 }}>
                    {p.include ? <CheckCircle2 size={17} color={C.accent} /> : <Circle size={17} color={C.textFaint} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input value={p.title} onChange={e => updatePendingRow(p._id, { title: e.target.value })} className="wh-input" style={{ ...inputStyle(), fontSize: 13.5, marginBottom: 6 }} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <input value={p.project || ""} placeholder="專案" onChange={e => updatePendingRow(p._id, { project: e.target.value })} className="wh-input" style={{ ...inputStyle(), flex: "1 1 90px", fontSize: 12 }} />
                      <input value={(p.assignees || []).join("、")} placeholder="負責人（可多個，用、分隔）" onChange={e => updatePendingRow(p._id, { assignees: e.target.value.split(/[、,，\s]+/).filter(Boolean) })} className="wh-input" style={{ ...inputStyle(), flex: "1 1 100px", fontSize: 12 }} />
                      <select className="wh-select" value={p.bucket} onChange={e => updatePendingRow(p._id, { bucket: e.target.value })} style={{ ...inputStyle(), flex: "1 1 70px", fontSize: 12 }}>
                        {BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                      </select>
                      <input type="date" className="wh-input wh-date" value={p.due_date || ""} onChange={e => updatePendingRow(p._id, { due_date: e.target.value })} style={{ ...inputStyle(), flex: "1 1 110px", fontSize: 12 }} />
                    </div>
                    {p.confidence === "low" && <div style={{ fontSize: 10.5, color: C.warn, marginTop: 4 }}>信心較低，建議確認內容</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button className="wh-btn" onClick={cancelPending} style={ghostBtnStyle()}>取消</button>
              <button className="wh-btn" onClick={confirmPending} style={primaryBtnStyle()}>加入 {pending.filter(p => p.include).length} 項</button>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="wh-fadein" style={{ position: "absolute", inset: 0, background: "rgba(6,9,14,0.88)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 10 }}>
            <div style={{ width: "100%", maxWidth: 420, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }} className="wh-scroll">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>設定</div>
                <IconBtn onClick={() => setShowSettings(false)} title="關閉"><X size={15} /></IconBtn>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Users size={13} color={C.textDim} /><span style={{ fontSize: 12, fontWeight: 700, color: C.textDim }}>工作同仁</span>
              </div>
              <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 8, lineHeight: 1.5 }}>平常只看得到自己的工作；某項工作若有同仁一起負責，才會在那項工作上看到彼此。</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                {colleagues.length === 0 ? <div style={{ fontSize: 11.5, color: C.textFaint }}>還沒有同仁</div> : colleagues.map(c => (
                  <div key={c} className="wh-colrow" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 6px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: C.text }}><User size={11} color={C.textFaint} />{c}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {collabCount(c) > 0 && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.accent }}>共 {collabCount(c)} 項</span>}
                      <IconBtn onClick={() => removeColleague(c)} title="移除" color={C.danger}><Trash2 size={11} /></IconBtn>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 5, marginBottom: 18 }}>
                <input className="wh-input" placeholder="新增同仁" value={newColleagueName} onChange={e => setNewColleagueName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColleague(newColleagueName); } }} style={{ ...inputStyle(), flex: 1, fontSize: 12 }} />
                <IconBtn onClick={() => addColleague(newColleagueName)} title="新增"><UserPlus size={13} /></IconBtn>
              </div>
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Lock size={13} color={C.textDim} /><span style={{ fontSize: 12, fontWeight: 700, color: C.textDim }}>AI 功能啟用碼</span>
                </div>
                <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 8, lineHeight: 1.5 }}>
                  這裡設定的是共用啟用碼，交給付費使用 AI 分析的同仁輸入。這不是真正的付款或帳號驗證，只是一個共用密碼。
                </div>
                <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>目前啟用碼：<span style={{ fontFamily: FONT_MONO, color: C.accent }}>{aiUnlockCode || "（尚未設定）"}</span></div>
                <div style={{ display: "flex", gap: 5 }}>
                  <input className="wh-input" placeholder="設定新的啟用碼" value={newCodeDraft} onChange={e => setNewCodeDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adminSetCode(); } }} style={{ ...inputStyle(), flex: 1, fontSize: 12 }} />
                  <button className="wh-btn" onClick={adminSetCode} style={primaryBtnStyle()}>更新</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function inputStyle() {
  return { width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", color: C.text, fontSize: 13, fontFamily: FONT_MONO };
}
function labelStyle() { return { fontSize: 10.5, color: C.textFaint, display: "flex", flexDirection: "column", gap: 3, flex: "1 1 120px" }; }
function primaryBtnStyle() { return { padding: "7px 14px", borderRadius: 8, background: C.accent, color: "#062622", fontWeight: 700, fontSize: 12.5, border: "none" }; }
function ghostBtnStyle() { return { padding: "7px 14px", borderRadius: 8, background: "transparent", color: C.textDim, fontWeight: 600, fontSize: 12.5, border: `1px solid ${C.border}` }; }
function emptyStyle() { return { padding: "36px 12px", textAlign: "center", color: C.textFaint, fontSize: 13, lineHeight: 1.6 }; }
