'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function sanitizeKey(name) {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
  if (cleaned) return cleaned;
  let hash = 0;
  for (const char of name.trim()) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return 'persona_' + hash.toString(36);
}

/* ---------- iconos simples en SVG (sin dependencias externas) ---------- */
const Icon = ({ path, className = 'w-5 h-5', fill = 'none' }) => (
  <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {path}
  </svg>
);
const IconPlus = (p) => <Icon {...p} path={<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>} />;
const IconTrash = (p) => <Icon {...p} path={<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></>} />;
const IconUsers = (p) => <Icon {...p} path={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const IconLogOut = (p) => <Icon {...p} path={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>} />;
const IconRefresh = (p) => <Icon {...p} path={<><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>} />;
const IconCheckCircle = (p) => <Icon {...p} path={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} />;
const IconCircle = (p) => <Icon {...p} path={<circle cx="12" cy="12" r="10" />} />;
const IconClipboard = (p) => <Icon {...p} path={<><path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" /><rect x="4" y="4" width="16" height="18" rx="2" /><line x1="8" y1="11" x2="16" y2="11" /><line x1="8" y1="15" x2="14" y2="15" /></>} />;
const IconGrid = (p) => <Icon {...p} path={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>} />;
const IconWaves = (p) => <Icon {...p} path={<><path d="M2 6c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0 3.5 1.5 5 0 3.5-1.5 5 0" /><path d="M2 12c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0 3.5 1.5 5 0 3.5-1.5 5 0" /><path d="M2 18c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0 3.5 1.5 5 0 3.5-1.5 5 0" /></>} />;

function ProgressRing({ percent, size = 76, stroke = 8 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#DBEAFE" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#0EA5E9" strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-blue-900">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}

export default function TeamPlanner() {
  const [stage, setStage] = useState('loading');
  const [nameInput, setNameInput] = useState('');
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [todos, setTodos] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [view, setView] = useState('mine');
  const [boardData, setBoardData] = useState([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [error, setError] = useState('');
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.from('members').select('key, name').order('created_at');
      if (err) {
        setError('No se pudo conectar con la base de datos. Intenta de nuevo.');
      } else {
        setMembers(data || []);
      }
      setStage('login');
    })();
  }, []);

  const loadTodosFor = async (key) => {
    const { data, error: err } = await supabase
      .from('todos')
      .select('id, text, done')
      .eq('member_key', key)
      .order('created_at');
    if (err) {
      setError('No se pudieron cargar tus pendientes. Intenta de nuevo.');
      return [];
    }
    return data || [];
  };

  const enterWithName = async (rawName) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    setEntering(true);
    setError('');
    const key = sanitizeKey(trimmed);
    const existing = members.find((m) => m.key === key);
    let displayName = trimmed;

    if (!existing) {
      const { error: insertErr } = await supabase.from('members').insert({ key, name: trimmed });
      if (insertErr && insertErr.code !== '23505') {
        setError('No se pudo entrar. Intenta de nuevo.');
        setEntering(false);
        return;
      }
      if (insertErr && insertErr.code === '23505') {
        const { data: existingRow } = await supabase.from('members').select('key, name').eq('key', key).single();
        if (existingRow) displayName = existingRow.name;
      }
      setMembers((prev) => (prev.find((m) => m.key === key) ? prev : [...prev, { key, name: displayName }]));
    } else {
      displayName = existing.name;
    }

    const t = await loadTodosFor(key);
    setCurrentUser({ name: displayName, key });
    setTodos(t);
    setStage('app');
    setView('mine');
    setNameInput('');
    setEntering(false);
  };

  const addTask = async () => {
    const text = newTask.trim();
    if (!text || !currentUser) return;
    const { data, error: err } = await supabase
      .from('todos')
      .insert({ member_key: currentUser.key, text })
      .select('id, text, done')
      .single();
    if (err) {
      setError('No se pudo guardar el pendiente. Intenta de nuevo.');
      return;
    }
    setError('');
    setNewTask('');
    setTodos((prev) => [...prev, data]);
  };

  const toggleTask = async (id) => {
    const target = todos.find((t) => t.id === id);
    if (!target) return;
    const nextDone = !target.done;
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)));
    const { error: err } = await supabase.from('todos').update({ done: nextDone }).eq('id', id);
    if (err) {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: target.done } : t)));
      setError('No se pudo guardar el cambio. Intenta de nuevo.');
    } else {
      setError('');
    }
  };

  const deleteTask = async (id) => {
    const target = todos.find((t) => t.id === id);
    const targetIndex = todos.findIndex((t) => t.id === id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    const { error: err } = await supabase.from('todos').delete().eq('id', id);
    if (err && target) {
      setTodos((prev) => {
        const next = [...prev];
        next.splice(targetIndex, 0, target);
        return next;
      });
      setError('No se pudo eliminar el pendiente. Intenta de nuevo.');
    } else {
      setError('');
    }
  };

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    setError('');
    const { data: memberList, error: memberErr } = await supabase
      .from('members')
      .select('key, name')
      .order('created_at');
    if (memberErr) {
      setError('No se pudo cargar el tablero. Intenta de nuevo.');
      setBoardLoading(false);
      return;
    }
    setMembers(memberList || []);

    const { data: allTodos, error: todosErr } = await supabase.from('todos').select('id, member_key, text, done');
    if (todosErr) {
      setError('No se pudo cargar el tablero. Intenta de nuevo.');
      setBoardLoading(false);
      return;
    }

    const results = (memberList || []).map((m) => {
      const mine = (allTodos || []).filter((t) => t.member_key === m.key);
      const done = mine.filter((t) => t.done).length;
      return { ...m, total: mine.length, done, pending: mine.filter((t) => !t.done) };
    });
    setBoardData(results);
    setBoardLoading(false);
  }, []);

  useEffect(() => {
    if (view === 'board') loadBoard();
  }, [view, loadBoard]);

  const logout = () => {
    setCurrentUser(null);
    setTodos([]);
    setStage('login');
    setView('mine');
  };

  const doneCount = todos.filter((t) => t.done).length;
  const totalCount = todos.length;
  const percent = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;
  const initials = currentUser
    ? currentUser.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
    : '';

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-sky-400">
        <IconRefresh className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (stage === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-sky-400 px-4 py-10 relative overflow-hidden">
        <svg className="absolute bottom-0 left-0 w-full opacity-30" viewBox="0 0 1440 200" preserveAspectRatio="none">
          <path fill="#E0F2FE" d="M0,120 C240,180 480,60 720,90 C960,120 1200,200 1440,140 L1440,200 L0,200 Z" />
        </svg>
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-1">
            <IconWaves className="w-6 h-6 text-sky-500" />
            <span className="text-xs font-semibold tracking-widest text-sky-500 uppercase">Planner de equipo</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-900 mb-6">¿Cómo te llamas?</h1>

          <form onSubmit={(e) => { e.preventDefault(); enterWithName(nameInput); }} className="flex flex-col gap-3">
            <input
              type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              placeholder="Escribe tu nombre"
              className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
              autoFocus
            />
            <button type="submit" disabled={entering || !nameInput.trim()}
              className="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold transition-colors">
              {entering ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

          {members.length > 0 && (
            <div className="mt-7">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ya registradas</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button key={m.key} onClick={() => enterWithName(m.name)}
                    className="px-3 py-1.5 rounded-full bg-sky-50 text-blue-700 text-sm font-medium hover:bg-sky-100 transition-colors">
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50">
      <header className="bg-white border-b border-blue-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconWaves className="w-5 h-5 text-sky-500" />
            <span className="font-bold text-blue-900">Planner de equipo</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
            <span className="text-sm text-slate-600 hidden sm:inline">{currentUser?.name}</span>
            <button onClick={logout} className="text-slate-400 hover:text-blue-600 transition-colors" title="Cambiar de persona">
              <IconLogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pb-2">
          <button onClick={() => setView('mine')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'mine' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-sky-100'}`}>
            <IconClipboard className="w-4 h-4" />
            Mi lista
          </button>
          <button onClick={() => setView('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'board' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-sky-100'}`}>
            <IconGrid className="w-4 h-4" />
            Tablero de equipo
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && <div className="mb-4 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

        {view === 'mine' && (
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <ProgressRing percent={percent} />
              <div>
                <p className="text-lg font-semibold text-blue-900">{doneCount} de {totalCount} completadas</p>
                <p className="text-sm text-slate-400">
                  {totalCount === 0 ? 'Aún no tienes pendientes.' :
                    totalCount - doneCount === 0 ? 'Terminaste todo por ahora.' :
                    `Te ${totalCount - doneCount === 1 ? 'falta' : 'faltan'} ${totalCount - doneCount}.`}
                </p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); addTask(); }} className="flex gap-2">
              <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
                placeholder="Agregar un pendiente..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-blue-100 bg-white text-blue-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <button type="submit" disabled={!newTask.trim()}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center gap-1.5 font-medium transition-colors">
                <IconPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Agregar</span>
              </button>
            </form>

            <div className="flex flex-col gap-2">
              {todos.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <IconClipboard className="w-10 h-10 mx-auto mb-2 text-sky-200" />
                  <p>Agrega tu primer pendiente arriba.</p>
                </div>
              )}
              {todos.map((t) => (
                <div key={t.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 group">
                  <button onClick={() => toggleTask(t.id)} className="shrink-0">
                    {t.done ? <IconCheckCircle className="w-5 h-5 text-sky-500" /> : <IconCircle className="w-5 h-5 text-blue-200" />}
                  </button>
                  <span className={`flex-1 text-sm ${t.done ? 'line-through text-slate-300' : 'text-blue-900'}`}>{t.text}</span>
                  <button onClick={() => deleteTask(t.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Eliminar">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'board' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-900">
                <IconUsers className="w-5 h-5 text-sky-500" />
                <h2 className="font-semibold">Avance del equipo</h2>
                <span className="text-sm text-slate-400">({boardData.length})</span>
              </div>
              <button onClick={loadBoard} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors">
                <IconRefresh className={`w-4 h-4 ${boardLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {boardData.length === 0 && !boardLoading && (
              <div className="text-center py-14 text-slate-400">
                <IconUsers className="w-10 h-10 mx-auto mb-2 text-sky-200" />
                <p>Todavía no hay nadie registrado en el equipo.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {boardData.map((m) => {
                const pct = m.total === 0 ? 0 : (m.done / m.total) * 100;
                return (
                  <div key={m.key} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <ProgressRing percent={pct} size={56} stroke={6} />
                      <div>
                        <p className="font-semibold text-blue-900">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.done}/{m.total} completadas</p>
                      </div>
                    </div>
                    {m.pending.length > 0 ? (
                      <ul className="text-sm text-slate-500 flex flex-col gap-1">
                        {m.pending.slice(0, 3).map((p) => (
                          <li key={p.id} className="flex items-center gap-1.5">
                            <IconCircle className="w-3 h-3 text-blue-200 shrink-0" />
                            <span className="truncate">{p.text}</span>
                          </li>
                        ))}
                        {m.pending.length > 3 && <li className="text-xs text-sky-500">+{m.pending.length - 3} más</li>}
                      </ul>
                    ) : (
                      <p className="text-sm text-sky-500">Sin pendientes por ahora ✓</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
