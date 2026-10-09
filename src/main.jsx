import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownUp, ArrowLeft, ArrowRight, BookOpen, Brain, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command, FileImage, FileText, Folder, FolderPlus, Hash, Heart, Home, KeyRound, LogOut, Menu, Mic, Moon, MoreHorizontal, Plus, Search, Send, Settings, Share2, Sparkles, Sun, Trash2, Upload, X, Zap } from 'lucide-react';
import './style.css';
import './extras.css';
import './chat.css';
import './editor.css';
const API = import.meta.env.VITE_API_URL || '';
const tokenKey = 'ainotes.session';
const themeKey = 'ainotes.theme';
const dateLabel = (date) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date));

async function api(path, options = {}) {
  const token = sessionStorage.getItem(tokenKey);
  const response = await fetch(`${API}/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('all');
  const [activeView, setActiveView] = useState('home');
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem(themeKey) === 'dark');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [chatQuestion, setChatQuestion] = useState('');
  const [studyMode, setStudyMode] = useState('');
  const [showAccount, setShowAccount] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [semanticMode, setSemanticMode] = useState(false);
  const [semanticResults, setSemanticResults] = useState([]);
  const [sharedNote, setSharedNote] = useState(null);
  const [sharedError, setSharedError] = useState('');

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem(themeKey, dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { if (notice) { const id = setTimeout(() => setNotice(''), 3600); return () => clearTimeout(id); } }, [notice]);
  useEffect(() => {
    const shareMatch = window.location.pathname.match(/^\/shared\/([^/]+)$/);
    if (shareMatch) { api(`/shared/${encodeURIComponent(shareMatch[1])}`).then(({ note }) => setSharedNote(note)).catch(e => setSharedError(e.message)).finally(() => setLoading(false)); return; }
    const token = sessionStorage.getItem(tokenKey);
    if (!token) { setLoading(false); return; }
    api('/auth/me').then(({ user: me }) => setUser(me)).catch(() => sessionStorage.removeItem(tokenKey)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (user) refresh(); }, [user]);
  useEffect(() => { const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && user) { e.preventDefault(); createNote(); } if (e.key === 'Escape') { setSearchOpen(false); setSelected(null); setStudyMode(''); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [user, activeFolder]);

  async function refresh() {
    try { const [n, f] = await Promise.all([api('/notes'), api('/folders')]); setNotes(n.notes); setFolders(f.folders); }
    catch (e) { if (/token|authorization|expired/i.test(e.message)) logout(); else setNotice(e.message); }
  }
  function logout() { sessionStorage.removeItem(tokenKey); setUser(null); setNotes([]); setFolders([]); setSelected(null); }
  const folderNotes = useMemo(() => activeFolder === 'all' ? notes : activeFolder === 'favorites' ? notes.filter(n => n.favorite) : notes.filter(n => n.folder_id === Number(activeFolder)), [notes, activeFolder]);
  const searched = useMemo(() => { const raw = query.toLowerCase().trim(); if (!raw) return folderNotes; if (raw.startsWith('#')) return folderNotes.filter(n => n.tags.some(tag => tag.toLowerCase() === raw.slice(1))); return folderNotes.filter(n => `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(raw)); }, [folderNotes, query]);
  const allTags = [...new Set(notes.flatMap(note => note.tags))].sort();
  const recent = [...notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 3);

  async function authenticate(event) {
    event.preventDefault(); setAuthError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try { const result = await api(`/auth/${authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(body) }); sessionStorage.setItem(tokenKey, result.token); setUser(result.user); }
    catch (e) { setAuthError(e.message); } finally { setBusy(false); }
  }
  async function createNote(folderId = null) {
    try { const { note } = await api('/notes', { method: 'POST', body: JSON.stringify({ title: 'Untitled note', content: '', folder_id: folderId }) }); await refresh(); setSelected(note); setActiveView('notes'); }
    catch (e) { setNotice(e.message); }
  }
  async function createFolder() {
    const name = prompt('Name your folder'); if (!name?.trim()) return;
    try { const { folder } = await api('/folders', { method: 'POST', body: JSON.stringify({ name }) }); setFolders([...folders, folder]); setActiveFolder(String(folder.id)); setActiveView('notes'); setNotice('Your folder is ready.'); }
    catch (e) { setNotice(e.message); }
  }
  async function saveNote(note) {
    try { const { note: saved } = await api(`/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify(note) }); setNotes(prev => [saved, ...prev.filter(n => n.id !== saved.id)].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))); setSelected(saved); setNotice('All changes saved'); }
    catch (e) { setNotice(e.message); }
  }
  async function deleteNote(note) {
    if (!confirm(`Delete “${note.title || 'Untitled note'}”? This cannot be undone.`)) return;
    try { await api(`/notes/${note.id}`, { method: 'DELETE' }); setNotes(notes.filter(n => n.id !== note.id)); setSelected(null); setNotice('Note deleted'); }
    catch (e) { setNotice(e.message); }
  }
  async function doAI(kind, note = selected, question = chatQuestion) {
    if (!note) return;
    if (kind === 'chat' && !question.trim()) return;
    setBusy(true); setAiResult('');
    try { const { result } = await api(`/notes/${note.id}/ai/${kind}`, { method: 'POST', body: JSON.stringify({ question }) }); setAiResult(result); if (kind === 'summary') { await refresh(); setSelected(prev => prev?.id === note.id ? { ...prev, summary: result } : prev); } if (kind === 'tags') { const json = JSON.parse(result); await saveNote({ ...note, tags: json.tags || [] }); } if (kind === 'category') setNotice(`Suggested subject: ${JSON.parse(result).category}`); }
    catch (e) { setAiResult(e.message); } finally { setBusy(false); }
  }
  async function shareNote(note) {
    try { const { url } = await api(`/notes/${note.id}/share`, { method: 'POST', body: '{}' }); await navigator.clipboard.writeText(url); await refresh(); setNotice('Private read-only link copied'); }
    catch (e) { setNotice(e.message); }
  }
  async function revokeShare(note) {
    try { await api(`/notes/${note.id}/share`, { method: 'DELETE' }); await refresh(); setSelected({ ...note, shared: false }); setNotice('Share link revoked'); }
    catch (e) { setNotice(e.message); }
  }
  async function runSemanticSearch() {
    if (!query.trim()) { setNotice('Enter a phrase to search by meaning.'); return; }
    setBusy(true);
    try { const { results } = await api('/search/semantic', { method: 'POST', body: JSON.stringify({ query }) }); setSemanticResults(results.map(row => row.note)); setSemanticMode(true); }
    catch (e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function checkDuplicates(note) {
    try { const { matches } = await api(`/notes/${note.id}/duplicates`); setAiResult(matches.length ? matches.map(row => `${Math.round(row.similarity * 100)}% similar: ${row.note.title}`).join('\n') : 'No close matches found in your notes.'); }
    catch (e) { setNotice(e.message); }
  }
  async function exportPdf(note) { const { jsPDF } = await import('jspdf'); const doc = new jsPDF(); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(note.title || 'Untitled note', 18, 22); doc.setFont('helvetica', 'normal'); doc.setFontSize(11); const lines = doc.splitTextToSize(note.content || 'This note is empty.', 174); const pageHeight = doc.internal.pageSize.getHeight(); let y = 34; for (const line of lines) { if (y > pageHeight - 18) { doc.addPage(); y = 20; } doc.text(line, 18, y); y += 6; } doc.save(`${(note.title || 'note').replace(/[^a-z0-9-_ ]/gi, '').slice(0, 40)}.pdf`); }
  async function importFile(file) {
    setBusy(true); setNotice(`Reading ${file.name}…`);
    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjs = await import('pdfjs-dist'); const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url'); pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map(item => item.str).join(' ') + '\n\n'; }
        if (!text.trim()) throw new Error('This PDF contains no selectable text. Try taking a clear image and uploading it instead.');
      } else if (file.type.startsWith('image/')) {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng'); const result = await worker.recognize(file); text = result.data.text; await worker.terminate();
        if (!text.trim()) throw new Error('No text could be detected. Try a sharper, well-lit image.');
      } else throw new Error('Choose a PDF or image file.');
      const { note } = await api('/notes', { method: 'POST', body: JSON.stringify({ title: file.name.replace(/\.[^.]+$/, ''), content: text, folder_id: activeFolder === 'all' || activeFolder === 'favorites' ? null : Number(activeFolder), tags: ['Imported'] }) });
      await refresh(); setSelected(note); setNotice('Text extracted. Review and correct it in your note.');
    } catch (e) { setNotice(e.message); } finally { setBusy(false); }
  }
  function startVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { setNotice('Voice input is not supported in this browser. Try Chrome or Edge.'); return; }
    const recognition = new Speech(); recognition.lang = navigator.language || 'en-US'; recognition.interimResults = false;
    recognition.onresult = (e) => { const value = e.results[0][0].transcript; setSelected(prev => prev ? { ...prev, content: `${prev.content}${prev.content ? '\n' : ''}${value}` } : prev); setNotice('Voice note captured. Save your changes when ready.'); };
    recognition.onerror = () => setNotice('Could not capture voice. Check microphone permission and try again.'); recognition.start(); setNotice('Listening… speak now.');
  }

  if (loading) return <div className="loading-screen"><div className="brand-mark"><BookOpen size={24}/></div><span>Getting your desk ready…</span></div>;
  if (sharedNote || sharedError) return <SharedNote note={sharedNote} error={sharedError}/>;
  if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={authenticate} error={authError} busy={busy}/>;

  const activeFolderName = activeFolder === 'all' ? 'All notes' : activeFolder === 'favorites' ? 'Favorites' : folders.find(f => f.id === Number(activeFolder))?.name || 'Your notes';
  const displayNotes = semanticMode ? semanticResults : activeView === 'favorites' ? notes.filter(n => n.favorite) : searched;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><BookOpen size={21}/></div><div><strong>memo<span>mind</span></strong><small>YOUR STUDY SPACE</small></div><button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18}/></button></div>
      <button className="new-note-btn" onClick={() => createNote(activeFolder === 'all' || activeFolder === 'favorites' ? null : Number(activeFolder))}><Plus size={18}/> New note <span>⌘ N</span></button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="nav-links">
        <button className={activeView === 'home' ? 'active' : ''} onClick={() => { setActiveView('home'); setActiveFolder('all'); }}><Home size={17}/> Home</button>
        <button className={activeView === 'notes' && activeFolder === 'all' ? 'active' : ''} onClick={() => { setActiveView('notes'); setActiveFolder('all'); }}><FileText size={17}/> All notes <span className="nav-count">{notes.length}</span></button>
        <button className={activeFolder === 'favorites' ? 'active' : ''} onClick={() => { setActiveView('notes'); setActiveFolder('favorites'); }}><Heart size={17}/> Favorites <span className="nav-count">{notes.filter(n => n.favorite).length}</span></button>
        <button onClick={() => setChatOpen(true)}><Brain size={17}/> Ask my notes</button>
      </nav>
      <div className="sidebar-section-title"><span>MY FOLDERS</span><button className="icon-btn mini" title="Add folder" onClick={createFolder}><Plus size={15}/></button></div>
      <nav className="folder-list">{folders.map(folder => <button className={String(folder.id) === activeFolder ? 'active' : ''} key={folder.id} onClick={() => { setActiveFolder(String(folder.id)); setActiveView('notes'); }}><Folder size={16} style={{ color: folder.color }}/>{folder.name}<span className="nav-count">{folder.note_count}</span></button>)}{folders.length === 0 && <small className="side-empty">Folders keep classes tidy.</small>}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-spark"><Sparkles size={16}/></div><b>Study smarter</b><p>Turn your notes into a study plan.</p><button onClick={() => setStudyMode('overview')}>Explore study tools <ArrowRight size={14}/></button></div>
        <button className="profile-row" onClick={() => setShowAccount(!showAccount)}><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><b>{user.name}</b><small>Personal workspace</small></div><MoreHorizontal size={18}/></button>{showAccount && <div className="account-pop"><span>{user.email}</span><button onClick={() => setDark(!dark)}>{dark ? <Sun size={15}/> : <Moon size={15}/>} {dark ? 'Light appearance' : 'Dark appearance'}</button><button onClick={logout}><LogOut size={15}/> Log out</button></div>}
      </div>
    </aside>
    {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{activeView === 'home' ? 'Home' : activeView === 'search' ? 'Search' : activeFolderName}</b></div><div className="top-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Search notes…</span><kbd>⌘ K</kbd></button><button className="icon-btn theme-toggle" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><div className="top-avatar">{user.name.slice(0, 1).toUpperCase()}</div></div></header>
      <div className="page-wrap">
        {activeView === 'home' ? <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR LEARNING SPACE</div><h1>{greeting}, {user.name.split(' ')[0]} <span className="wave">✳</span></h1><p>Ready to make sense of what you're learning?</p></div><div className="date-chip"><Clock3 size={15}/>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</div></section>
          <section className="hero-card"><div className="hero-copy"><div className="hero-kicker"><Sparkles size={14}/> YOUR IDEAS, IN FOCUS</div><h2>Make room for<br/><em>the “aha” moments.</em></h2><p>Capture what you learn. Let your notes do more.</p><button className="hero-cta" onClick={() => createNote()}>Create a note <ArrowRight size={16}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="art-sun"/><div className="art-card art-card-one"><span className="art-line coral"/><span className="art-line long"/><span className="art-line"/><span className="art-highlight"/></div><div className="art-card art-card-two"><Sparkles size={19}/><span>idea<br/>connected</span></div><div className="art-leaf leaf-one"/><div className="art-leaf leaf-two"/></div></section>
          <section className="stats-grid"><div className="stat-card"><div className="stat-icon lilac"><FileText size={18}/></div><div><span>Notes captured</span><strong>{notes.length}</strong></div><small className="stat-detail"><span className="stat-dot"/> Ready when you are</small></div><div className="stat-card"><div className="stat-icon peach"><Folder size={18}/></div><div><span>Study folders</span><strong>{folders.length}</strong></div><small className="stat-detail">Across your subjects</small></div><div className="stat-card"><div className="stat-icon mint"><Zap size={18}/></div><div><span>Study streak</span><strong>Start today</strong></div><small className="stat-detail"><span className="streak-stars">✦ ✦ ✦</span> Your first day starts now</small></div></section>
          <section className="content-grid"><div className="recent-panel"><div className="section-heading"><div><span className="section-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h3>Recently opened</h3></div><button className="text-link" onClick={() => { setActiveView('notes'); setActiveFolder('all'); }}>All notes <ArrowRight size={15}/></button></div>
            {recent.length ? <div className="recent-list">{recent.map(note => <NoteRow key={note.id} note={note} onClick={() => setSelected(note)} onFavorite={() => saveNote({ ...note, favorite: !note.favorite })}/>)}</div> : <div className="empty-card"><div className="empty-icon"><BookOpen size={22}/></div><b>Your first idea starts here</b><p>Add your class notes, a spark of inspiration, or that thing you don't want to forget.</p><button className="small-primary" onClick={() => createNote()}>Create your first note <ArrowRight size={15}/></button></div>}
          </div><div className="quick-panel"><div className="section-heading"><div><span className="section-eyebrow">A LITTLE MOMENTUM</span><h3>Quick capture</h3></div><div className="quick-spark"><Sparkles size={16}/></div></div><button className="quick-action" onClick={() => createNote()}><div className="quick-icon purple"><FileText size={17}/></div><span><b>Start with a blank note</b><small>Let the ideas find their shape</small></span><ChevronRight size={16}/></button><label className="quick-action upload-action"><div className="quick-icon yellow"><Upload size={17}/></div><span><b>Import your notes</b><small>PDF, photo, or scanned page</small></span><ChevronRight size={16}/><input type="file" accept="application/pdf,image/*" onChange={e => e.target.files?.[0] && importFile(e.target.files[0])} hidden/></label><button className="quick-action" onClick={() => setStudyMode('overview')}><div className="quick-icon mint"><Brain size={17}/></div><span><b>Make a study set</b><small>Turn one note into a review</small></span><ChevronRight size={16}/></button><div className="tip-card"><div className="tip-icon"><Sparkles size={14}/></div><div><b>A tiny tip</b><p>Good notes don't need to be perfect. Start messy, find the meaning later.</p></div></div></div></section>
          <footer className="footer-line"><span>Made for curious minds</span><span><span className="footer-flower">✿</span> One note at a time</span></footer>
        </> : <>
          <section className="list-heading"><div className="eyebrow"><span className="eyebrow-dot"/> YOUR LIBRARY</div><h1>{activeView === 'search' ? 'Search your notes' : activeFolderName}</h1><p>Every thought you've captured, all in one place.</p></section>
          <div className="library-toolbar"><div className="library-search"><Search size={17}/><input value={query} onChange={e => { setQuery(e.target.value); setSemanticMode(false); }} placeholder="Search by title, content, or tag…"/><kbd>⌘ K</kbd></div><button className={`import-btn semantic-btn ${semanticMode ? 'selected' : ''}`} disabled={busy} onClick={semanticMode ? () => setSemanticMode(false) : runSemanticSearch}><Sparkles size={15}/>{semanticMode ? 'Meaning results' : 'Search by meaning'}</button><label className="import-btn"><Upload size={16}/> Import<input type="file" accept="application/pdf,image/*" hidden onChange={e => e.target.files?.[0] && importFile(e.target.files[0])}/></label><button className="primary-btn" onClick={() => createNote(activeFolder === 'all' || activeFolder === 'favorites' ? null : Number(activeFolder))}><Plus size={16}/> New note</button></div>
          <div className="tag-filter"><button className={!query.startsWith('#') ? 'selected' : ''} onClick={() => setQuery('')}>All</button>{allTags.map(tag => <button key={tag} onClick={() => setQuery(`#${tag}`)}><Hash size={12}/>{tag}</button>)}</div>
          {displayNotes.length ? <div className="notes-grid">{displayNotes.map(note => <NoteCard key={note.id} note={note} folders={folders} onClick={() => setSelected(note)} onFavorite={() => saveNote({ ...note, favorite: !note.favorite })}/>)}</div> : <div className="empty-card library-empty"><div className="empty-icon"><Search size={22}/></div><b>{query ? 'No matching notes' : 'Nothing here just yet'}</b><p>{query ? 'Try another keyword or clear your search.' : 'Create a note or import a PDF or image to get started.'}</p><button className="small-primary" onClick={() => query ? setQuery('') : createNote()}>{query ? 'Clear search' : 'Create a note'} <ArrowRight size={15}/></button></div>}
          <footer className="footer-line"><span>{displayNotes.length} {displayNotes.length === 1 ? 'note' : 'notes'}</span><span>Stored privately in your workspace</span></footer>
        </>}
      </div>
    </main>
    {searchOpen && <SearchModal notes={notes} onClose={() => setSearchOpen(false)} onSelect={note => { setSelected(note); setSearchOpen(false); }}/ >}
    {chatOpen && <ChatModal onClose={() => setChatOpen(false)}/>}
    {selected && <NoteEditor note={selected} folders={folders} onClose={() => { setSelected(null); setAiResult(''); setStudyMode(''); }} onSave={saveNote} onDelete={deleteNote} onAI={doAI} onCheckDuplicates={checkDuplicates} aiResult={aiResult} busy={busy} onShare={shareNote} onRevoke={revokeShare} onExport={exportPdf} onVoice={startVoice} onStudy={mode => { setStudyMode(mode); doAI(mode === 'flashcards' || mode === 'quiz' ? mode : 'summary'); }}/ >}
    {studyMode === 'overview' && !selected && <StudyModal notes={notes} onClose={() => setStudyMode('')} onSelect={note => { setSelected(note); setStudyMode(''); }}/ >}
    {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice('')}><X size={14}/></button></div>}
  </div>;
}

function AuthScreen({ mode, setMode, onSubmit, error, busy }) {
  return <div className="auth-screen"><div className="auth-deco deco-one"/><div className="auth-deco deco-two"/><div className="auth-left"><div className="brand auth-brand"><div className="brand-mark"><BookOpen size={21}/></div><div><strong>memo<span>mind</span></strong><small>YOUR STUDY SPACE</small></div></div><div className="auth-message"><div className="auth-kicker"><Sparkles size={14}/> A CALMER WAY TO STUDY</div><h1>All your learning,<br/><em>in one lovely place.</em></h1><p>Keep your notes close, your thoughts clear, and your next big idea just around the corner.</p><div className="auth-note-art"><div className="auth-note paper-one"><span/><span/><span className="short"/></div><div className="auth-note paper-two"><Sparkles size={15}/><span className="note-lines"/><span className="note-lines short"/></div><div className="auth-orbit"/><div className="auth-bubble"><BookOpen size={16}/></div></div><div className="auth-quote">“A little progress each day adds up to big results.” <span>— Study mantra</span></div></div></div><div className="auth-right"><form className="auth-form" onSubmit={onSubmit}><div className="mobile-auth-brand"><div className="brand-mark"><BookOpen size={21}/></div><b>memo<span>mind</span></b></div><div className="form-eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'A FRESH START'}</div><h2>{mode === 'login' ? 'Your desk missed you.' : 'Make yourself at home.'}</h2><p className="form-subtitle">{mode === 'login' ? 'Pick up right where your curiosity left off.' : 'Create your personal space for learning.'}</p>
    {mode === 'register' && <label className="field-label">Your name<input name="name" type="text" autoComplete="name" placeholder="e.g. Alex Rivera" minLength="2" maxLength="80" required/></label>}
    <label className="field-label">Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required/></label><label className="field-label">Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Enter your password' : 'At least 10 characters + a number'} minLength={mode === 'register' ? 10 : undefined} required/></label>
    {error && <div className="form-error"><CircleHelp size={16}/>{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Just a moment…' : mode === 'login' ? 'Sign in' : 'Create your account'}<ArrowRight size={17}/></button><div className="auth-switch">{mode === 'login' ? 'New to memo mind?' : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div><div className="privacy-note"><KeyRound size={14}/> Your notes are private and belong to you.</div></form><div className="auth-footer">A thoughtful place to learn <span>✿</span></div></div></div>;
}

function NoteRow({ note, onClick, onFavorite }) { return <div className="recent-row"><button className="recent-main" onClick={onClick}><div className="note-square" style={{ background: note.color }}><FileText size={17}/></div><span><b>{note.title || 'Untitled note'}</b><small>{note.content.slice(0, 90) || 'No text yet'}</small></span></button><span className="recent-date">{dateLabel(note.updated_at)}</span><button className={`icon-btn fav-btn ${note.favorite ? 'favorited' : ''}`} onClick={onFavorite}><Heart size={16} fill={note.favorite ? 'currentColor' : 'none'}/></button><ChevronRight className="row-arrow" size={16}/></div>; }
function NoteCard({ note, folders, onClick, onFavorite }) { return <article className="note-card" onClick={onClick} style={{ '--note-color': note.color }}><div className="note-card-top"><div className="note-mark"><FileText size={16}/></div><button className={`icon-btn fav-btn ${note.favorite ? 'favorited' : ''}`} onClick={e => { e.stopPropagation(); onFavorite(); }}><Heart size={17} fill={note.favorite ? 'currentColor' : 'none'}/></button></div><h3>{note.title || 'Untitled note'}</h3><p>{note.content.slice(0, 160) || 'No text in this note yet. Open it to start writing.'}</p><div className="note-card-bottom"><div className="note-tags">{note.tags.slice(0, 2).map(t => <span key={t}><Hash size={11}/>{t}</span>)}{note.folder_id && <span className="folder-pill"><Folder size={11}/>{folders.find(f => f.id === note.folder_id)?.name || 'Folder'}</span>}</div><small>{dateLabel(note.updated_at)}</small></div></article>; }

function SearchModal({ notes, onClose, onSelect }) {
  const [q, setQ] = useState(''); const results = notes.filter(n => `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())).slice(0, 7);
  useEffect(() => { document.getElementById('global-search')?.focus(); }, []);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="search-modal" onMouseDown={e => e.stopPropagation()}><div className="global-search-field"><Search size={19}/><input id="global-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search your notes…"/><kbd>ESC</kbd></div><div className="search-results-label">{q ? 'MATCHING NOTES' : 'RECENT NOTES'}</div><div className="global-results">{results.map(note => <button key={note.id} onClick={() => onSelect(note)}><div className="note-square" style={{ background: note.color }}><FileText size={16}/></div><span><b>{note.title}</b><small>{note.content.slice(0, 72) || 'No text yet'}</small></span><span className="result-date">{dateLabel(note.updated_at)}</span></button>)}{results.length === 0 && <div className="search-no-results">No notes match that search.</div>}</div><div className="search-hint"><Command size={13}/> Quick search looks through titles, note text, and tags</div></div></div>;
}

function SharedNote({ note, error }) {
  return <div className="shared-screen"><div className="shared-brand"><div className="brand-mark"><BookOpen size={20}/></div><b>memo<span>mind</span></b></div>{note ? <article className="shared-paper"><div className="shared-label"><Share2 size={14}/> SHARED STUDY NOTE <span>READ ONLY</span></div><h1>{note.title}</h1><div className="shared-by">Shared by {note.owner_name} · Updated {dateLabel(note.updated_at)}</div><div className="shared-body">{note.content.split('\n').map((line, i) => line ? <p key={i}>{line}</p> : <br key={i}/>)}</div>{note.tags.length > 0 && <div className="shared-tags">{note.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}</article> : <div className="shared-paper shared-error"><div className="empty-icon"><KeyRound size={21}/></div><h1>This link isn't available</h1><p>{error || 'It may have expired or been revoked by its owner.'}</p></div>}<div className="shared-footer">A thoughtful place to learn <span>✿</span></div></div>;
}

function ChatModal({ onClose }) {
  const [question, setQuestion] = useState(''); const [answer, setAnswer] = useState(''); const [sources, setSources] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function ask(e) { e.preventDefault(); if (!question.trim()) return; setBusy(true); setError(''); setAnswer(''); setSources([]); try { const result = await api('/chat', { method: 'POST', body: JSON.stringify({ question }) }); setAnswer(result.answer); setSources(result.sources); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="chat-modal" onMouseDown={e => e.stopPropagation()}><button className="icon-btn modal-close" onClick={onClose}><X size={18}/></button><div className="study-modal-icon"><Brain size={23}/></div><div className="form-eyebrow">YOUR PRIVATE STUDY BUDDY</div><h2>Ask across your notes</h2><p>Answers use your latest 20 text notes and include note titles to help you find the source.</p><form className="chat-form" onSubmit={ask}><textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="What were the three causes of the French Revolution?" rows={3}/><button className="primary-btn" disabled={busy}>{busy ? 'Thinking…' : 'Ask my notes'} <Send size={14}/></button></form>{error && <div className="form-error"><CircleHelp size={15}/>{error}</div>}{answer && <div className="chat-answer"><div><Sparkles size={14}/> ANSWER</div><p>{answer}</p>{sources.length > 0 && <small>Checked {sources.length} notes: {sources.map(source => source.title).join(' · ')}</small>}</div>}</section></div>;
}

function StudyOutput({ result }) {
  const [revealed, setRevealed] = useState({}); const [answers, setAnswers] = useState({});
  let data; try { data = JSON.parse(result); } catch { return <p>{result}</p>; }
  if (Array.isArray(data.cards)) return <div className="study-output">{data.cards.map((card, index) => <button key={index} className="flashcard" onClick={() => setRevealed(prev => ({ ...prev, [index]: !prev[index] }))}><small>CARD {index + 1} · {revealed[index] ? 'ANSWER' : 'TAP TO REVEAL'}</small><span>{revealed[index] ? card.answer : card.question}</span></button>)}</div>;
  if (Array.isArray(data.questions)) return <div className="study-output">{data.questions.map((question, index) => <div className="quiz-question" key={index}><b>{index + 1}. {question.question}</b>{question.options?.map((option, optionIndex) => <button key={optionIndex} className={answers[index] === optionIndex ? (optionIndex === question.answer ? 'correct' : 'incorrect') : ''} onClick={() => setAnswers(prev => ({ ...prev, [index]: optionIndex }))}>{option}</button>)}{answers[index] !== undefined && <small>{answers[index] === question.answer ? 'That’s right. ' : 'Not quite. '}{question.explanation}</small>}</div>)}</div>;
  return <p>{data.category ? `Suggested subject: ${data.category}` : Array.isArray(data.tags) ? `Suggested tags: ${data.tags.join(', ')}` : result}</p>;
}

function inlineMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function NoteEditor({ note, folders, onClose, onSave, onDelete, onAI, onCheckDuplicates, aiResult, busy, onShare, onRevoke, onExport, onVoice, onStudy }) {
  const [draft, setDraft] = useState(note); const [tagInput, setTagInput] = useState(''); const [tab, setTab] = useState('write'); const [answer, setAnswer] = useState('');
  const textareaRef = React.useRef(null);
  useEffect(() => { setDraft(note); }, [note.id]);
  function update(key, value) { setDraft(prev => ({ ...prev, [key]: value })); }
  function insertMarkdown(prefix, suffix = prefix) { const field = textareaRef.current; if (!field) return; const start = field.selectionStart; const end = field.selectionEnd; const selection = draft.content.slice(start, end) || 'text'; const next = `${draft.content.slice(0, start)}${prefix}${selection}${suffix}${draft.content.slice(end)}`; update('content', next); requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + prefix.length, start + prefix.length + selection.length); }); }
  function addTag(e) { e.preventDefault(); const tag = tagInput.trim().replace(/^#/, ''); if (tag && !draft.tags.includes(tag)) update('tags', [...draft.tags, tag]); setTagInput(''); }
  return <div className="editor-backdrop" onMouseDown={onClose}><div className="editor-panel" onMouseDown={e => e.stopPropagation()}><header className="editor-top"><button className="back-button" onClick={onClose}><ArrowLeft size={17}/> <span>Back to notes</span></button><div className="editor-save-status"><span className="saved-dot"/>{draft.updated_at ? 'Saved' : 'Draft'}</div><div className="editor-actions"><button className="icon-btn" title="Voice input" onClick={onVoice}><Mic size={17}/></button><button className="icon-btn" title="Export PDF" onClick={() => onExport(draft)}><FileText size={17}/></button>{draft.shared ? <button className="icon-btn danger-icon" title="Revoke link" onClick={() => onRevoke(draft)}><Share2 size={17}/></button> : <button className="icon-btn" title="Share read-only link" onClick={() => onShare(draft)}><Share2 size={17}/></button>}<button className="icon-btn danger-icon" title="Delete note" onClick={() => onDelete(draft)}><Trash2 size={17}/></button><button className="editor-done" onClick={() => onSave(draft)}><Check size={16}/> Save</button><button className="icon-btn" onClick={onClose}><X size={18}/></button></div></header>
    <div className="editor-body"><div className="editor-main"><div className="editor-meta"><span className="meta-pill"><Clock3 size={13}/> Updated {dateLabel(draft.updated_at || new Date())}</span><span className="meta-sep">·</span><span className="meta-pill"><Folder size={13}/><select value={draft.folder_id || ''} onChange={e => update('folder_id', e.target.value ? Number(e.target.value) : null)}><option value="">No folder</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select><ChevronDown size={12}/></span></div><input className="note-title-input" value={draft.title} onChange={e => update('title', e.target.value)} placeholder="Give this note a title…"/><div className="editor-toolbar"><button className={tab === 'write' ? 'tool-active' : ''} onClick={() => setTab('write')}>Write</button><button className={tab === 'preview' ? 'tool-active' : ''} onClick={() => setTab('preview')}>Preview</button><span className="toolbar-divider"/><button className="format-btn" onClick={() => insertMarkdown('**')} title="Bold"><b>B</b></button><button className="format-btn" onClick={() => insertMarkdown('*')} title="Italic"><i>I</i></button><button className="format-btn" onClick={() => insertMarkdown('## ', '')} title="Heading">H</button><button className="format-btn" onClick={() => insertMarkdown('- ', '')} title="Bullet list">•</button><span className="format-hint">Markdown</span><button className="icon-btn auto-tag" title="Suggest tags with AI" onClick={() => onAI('tags', draft)}><Sparkles size={15}/></button></div>{tab === 'write' ? <textarea ref={textareaRef} className="note-content-input" value={draft.content} onChange={e => update('content', e.target.value)} placeholder="Start with the big idea. Add details as you go…\n\nTip: use **bold**, *italics*, ## headings, or - lists." spellCheck/> : <div className="note-preview">{draft.content ? draft.content.split('\n').map((line, i) => { const heading = line.match(/^(#{1,3})\s+(.+)/); const bullet = line.match(/^[-*]\s+(.+)/); if (heading) return <h3 key={i}>{inlineMarkdown(heading[2])}</h3>; if (bullet) return <p className="md-bullet" key={i}>• {inlineMarkdown(bullet[1])}</p>; return line ? <p key={i}>{inlineMarkdown(line)}</p> : <br key={i}/>; }) : <span>Your note is empty. Switch to Write to add something.</span>}</div>}<div className="editor-wordcount">{draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0} words <span>·</span> {draft.content.length} characters</div>

    {draft.summary && <div className="summary-inline"><div><Sparkles size={15}/> AI SUMMARY</div><p>{draft.summary}</p><button onClick={() => onAI('summary', draft)}>Refresh summary</button></div>}
    </div><aside className="editor-aside"><div className="aside-card"><div className="aside-title"><Hash size={15}/> TAGS</div><div className="tag-chips">{draft.tags.map(tag => <button key={tag} onClick={() => update('tags', draft.tags.filter(t => t !== tag))}>#{tag}<X size={11}/></button>)}{draft.tags.length === 0 && <span className="aside-muted">Add a tag to find this later</span>}</div><form className="tag-input-row" onSubmit={addTag}><input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add a tag…"/><button title="Add tag"><Plus size={15}/></button></form><button className="ai-suggest-tag" onClick={() => onAI('tags', draft)}><Sparkles size={13}/> Suggest tags</button></div>
    <div className="aside-card ai-card"><div className="ai-card-heading"><div className="ai-icon"><Sparkles size={15}/></div><div><b>Study buddy</b><small>A little help from AI</small></div><span className="beta-pill">AI</span></div><button className="ai-action" disabled={busy} onClick={() => onAI('summary', draft)}><span className="ai-action-icon"><FileText size={15}/></span><span><b>Summarize</b><small>Get the key points</small></span><ArrowRight size={14}/></button><button className="ai-action" disabled={busy} onClick={() => onStudy('flashcards')}><span className="ai-action-icon"><Brain size={15}/></span><span><b>Flashcards</b><small>Practice active recall</small></span><ArrowRight size={14}/></button><button className="ai-action" disabled={busy} onClick={() => onStudy('quiz')}><span className="ai-action-icon"><CircleHelp size={15}/></span><span><b>Quick quiz</b><small>Check what stuck</small></span><ArrowRight size={14}/></button><button className="ai-action" disabled={busy} onClick={() => onAI('category', draft)}><span className="ai-action-icon"><Activity size={15}/></span><span><b>Find a subject</b><small>Organize automatically</small></span><ArrowRight size={14}/></button></div>
    <div className="aside-card ask-card"><div className="aside-title"><Brain size={15}/> ASK YOUR NOTES</div><p>Ask a question and get an answer grounded in this note.</p><div className="ask-input"><input value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onAI('chat', draft, answer); }} placeholder="What should I remember?"/><button onClick={() => onAI('chat', draft, answer)}><Send size={14}/></button></div>{aiResult && <div className="ai-result"><div><Sparkles size={13}/>{busy ? 'Thinking…' : 'STUDY BUDDY'}</div><StudyOutput result={aiResult}/></div>}<button className="ai-suggest-tag" onClick={() => onCheckDuplicates(draft)}><ArrowDownUp size={13}/> Check for similar notes</button></div>
    <div className="private-note"><KeyRound size={14}/><span>Your notes are private.<br/><b>{draft.shared ? 'Read-only link is active.' : 'Only you can see this note.'}</b></span></div>
    </aside></div></div></div>;
}

function StudyModal({ notes, onClose, onSelect }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="study-modal" onMouseDown={e => e.stopPropagation()}><button className="icon-btn modal-close" onClick={onClose}><X size={18}/></button><div className="study-modal-icon"><Brain size={24}/></div><div className="form-eyebrow">STUDY TOOLKIT</div><h2>Choose a note to study</h2><p>Pick one of your notes, then ask your study buddy to make a quiz or flashcards from it.</p><div className="study-note-list">{notes.filter(n => n.content.trim()).slice(0, 8).map(note => <button key={note.id} onClick={() => onSelect(note)}><div className="note-square" style={{ background: note.color }}><FileText size={16}/></div><span><b>{note.title}</b><small>{note.content.slice(0, 65)}</small></span><ArrowRight size={16}/></button>)}</div>{notes.filter(n => n.content.trim()).length === 0 && <div className="search-no-results">Add a little text to a note first, then your study set can take shape.</div>}</div></div>; }

createRoot(document.getElementById('root')).render(<App/>);
