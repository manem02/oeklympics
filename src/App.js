import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import './App.css';

// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyBOv2UDlwB0oqvkvj-6EivkkfeO11ZNNHQ",
  authDomain: "oeklympics.firebaseapp.com",
  databaseURL: "https://oeklympics-default-rtdb.firebaseio.com",
  projectId: "oeklympics",
  storageBucket: "oeklympics.firebasestorage.app",
  messagingSenderId: "323608790037",
  appId: "1:323608790037:web:0a52e846e23e6349f23a1c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ============================================
// ASSET PATHS (files live in the public/ folder)
// ============================================
const HERO_IMG = `${process.env.PUBLIC_URL}/hero.jpg`;
const LOGO_IMG = `${process.env.PUBLIC_URL}/oek_logo_white.png`;

// ============================================
// DATA
// Each event/team has a stable `id` (DB key) and a display `name`.
// Renaming later won't break stored scores.
// ============================================
const TEAMS = [
  { id: 'eg', name: 'EG' },
  { id: 'stock1', name: '1. Stock' },
  { id: 'stock2', name: '2. Stock' },
  { id: 'stock3', name: '3. Stock' },
  { id: 'stock4', name: '4. Stock' }
];

const EVENTS = [
  { id: 'e01', name: 'Schach' },
  { id: 'e02', name: 'Tabu' },
  { id: 'e03', name: 'Sudoku' },
  { id: 'e04', name: 'FIFA' },
  { id: 'e05', name: 'Mario Kart' },
  { id: 'e06', name: 'Ping Pong' },
  { id: 'e07', name: 'Darts' },
  { id: 'e08', name: 'Kicker' },
  { id: 'e09', name: 'Treppen Bier' },
  { id: 'e10', name: 'Flanky Ball' },
  { id: 'e11', name: 'Slippery Bags' },
  { id: 'e12', name: 'Tug War' },
  { id: 'e13', name: 'Volleyball' },
  { id: 'e14', name: 'Spike Ball' },
  { id: 'e15', name: 'Beerpong' },
  { id: 'e16', name: 'Most Hair Cutting' },
  { id: 'e17', name: 'Videos with Quests' },
  { id: 'e18', name: '100m Sprint' },
  { id: 'e19', name: 'Karaoke' },
  { id: 'e20', name: 'Hot Dog Eating Contest' },
  { id: 'e21', name: 'Drawing of Johanna' },
  { id: 'e22', name: 'Questions About Johanna' },
  { id: 'e23', name: 'Trivia' }
];

// ============================================
// SCROLL REVEAL HOOK
// Adds class "in" when an element scrolls into view.
// ============================================
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = '' }) {
  const ref = useReveal();
  return (
      <div ref={ref} className={`reveal ${className}`}>
        {children}
      </div>
  );
}

// ============================================
// LEADERBOARD VIEW (PUBLIC)
// ============================================
function Leaderboard({ scores }) {
  const rankedTeams = TEAMS
      .map((team) => {
        let total = 0;
        EVENTS.forEach((event) => {
          total += scores?.[event.id]?.[team.id] || 0;
        });
        return { ...team, total };
      })
      .sort((a, b) => b.total - a.total);

  const leader = rankedTeams[0];
  const rest = rankedTeams.slice(1);

  // Scroll-driven fade: the photo holds through the rankings, then dissolves
  // into the Sunrise gradient as the event-breakdown section comes into view.
  const eventsRef = useRef(null);
  const [fade, setFade] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = eventsRef.current;
      const vh = window.innerHeight || 1;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Begin fading when the events section is one screen away (top === vh),
      // finish when its top reaches ~30% down the screen.
      const start = vh;        // fade = 0
      const end = vh * 0.3;    // fade = 1
      const f = Math.min(1, Math.max(0, (start - top) / (start - end)));
      setFade(f);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
      <div className="board">
        {/* HERO: fixed photo background lives in CSS via .hero-bg */}
        <section className="hero">
          <div className="hero-bg" style={{ backgroundImage: `url(${HERO_IMG})` }} />
          <div className="hero-shade" />
          {/* Sunrise fade layer — opacity driven by scroll */}
          <div className="hero-fade" style={{ opacity: fade }} />
          <div className="hero-logo" style={{ backgroundImage: `url(${LOGO_IMG})`, opacity: 1 - fade * 0.6 }} aria-label="ÖK logo" />
          <div className="hero-title" style={{ opacity: 1 - fade }}>
            <h1>ÖKLYMPICS</h1>
            <p className="hero-sub">Live Standings</p>
          </div>

          {/* Hero leader card */}
          <div className="hero-leader glass" style={{ opacity: 1 - fade }}>
            <div className="crown">👑</div>
            <div className="leader-info">
              <div className="leader-label">Leading</div>
              <div className="leader-name">{leader ? leader.name : '—'}</div>
            </div>
            <div className="leader-pts">
              {leader ? leader.total : 0}
              <span>pts</span>
            </div>
          </div>

          <div className="scroll-hint" style={{ opacity: 1 - fade }}>Scroll for full standings ↓</div>
        </section>

        {/* CONTENT scrolls over the fixed hero, sits on the Sunrise gradient */}
        <section className="content">
          <Reveal className="rankings-wrap">
            <h2 className="section-title">Full Rankings</h2>
            <div className="ranking-list">
              {rankedTeams.map((entry, idx) => (
                  <div key={entry.id} className={`rank-row glass ${idx === 0 ? 'is-leader' : ''}`}>
                    <div className="rk">{idx + 1}</div>
                    <div className="nm">{entry.name}</div>
                    <div className="pts">
                      {entry.total}
                      <span>pts</span>
                    </div>
                  </div>
              ))}
            </div>
          </Reveal>

          <div ref={eventsRef} aria-hidden="true" />
          <Reveal className="events-wrap">
            <h2 className="section-title">Event Breakdown</h2>
            <div className="event-grid">
              {EVENTS.map((event) => (
                  <div key={event.id} className="event-card glass">
                    <h3>{event.name}</h3>
                    <div className="event-scores-inner">
                      {TEAMS.map((team) => (
                          <div key={`${event.id}-${team.id}`} className="event-score">
                            <span className="team-label">{team.name}</span>
                            <span className="points">{scores?.[event.id]?.[team.id] || 0}</span>
                          </div>
                      ))}
                    </div>
                  </div>
              ))}
            </div>
          </Reveal>
        </section>
      </div>
  );
}

// ============================================
// ADMIN LOGIN
// ============================================
function AdminLogin({ onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="login-container">
        <div className="login-card glass-solid">
          <div className="login-logo" style={{ backgroundImage: `url(${LOGO_IMG})` }} aria-label="ÖK logo" />
          <h1>Admin Panel</h1>
          <p className="login-subtitle">Manage Öklympics Scores</p>

          <form onSubmit={handleLogin}>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Enter Admin Panel'}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}

          <button className="link-btn" onClick={onBack}>← Back to scoreboard</button>
        </div>
      </div>
  );
}

// ============================================
// ADMIN DASHBOARD
// ============================================
function AdminDashboard({ user, scores, onLogout }) {
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventScores, setEventScores] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      const existing = scores?.[editingEvent.id] || {};
      const filled = {};
      TEAMS.forEach((team) => {
        filled[team.id] = existing[team.id] || 0;
      });
      setEventScores(filled);
    }
  }, [editingEvent, scores]);

  const handleScoreChange = (teamId, newScore) => {
    setEventScores((prev) => ({
      ...prev,
      [teamId]: Math.max(0, newScore)
    }));
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await set(ref(database, `scores/${editingEvent.id}`), eventScores);
      setEditingEvent(null);
    } catch (err) {
      alert('Error saving scores. Are you still logged in?');
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <div className="admin-user">
            <span>{user.email}</span>
            <button onClick={onLogout} className="logout-btn">Logout</button>
          </div>
        </div>

        {editingEvent ? (
            <div className="edit-event-panel glass-solid">
              <h2>Editing: {editingEvent.name}</h2>
              <div className="score-inputs">
                {TEAMS.map((team) => (
                    <div key={team.id} className="input-group">
                      <label>{team.name}</label>
                      <input
                          type="number"
                          value={eventScores[team.id] ?? 0}
                          onChange={(e) => handleScoreChange(team.id, parseInt(e.target.value, 10) || 0)}
                          min="0"
                      />
                    </div>
                ))}
              </div>
              <div className="button-group">
                <button onClick={handleSaveEvent} className="save-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingEvent(null)} className="cancel-btn">Cancel</button>
              </div>
            </div>
        ) : (
            <div className="events-list glass-solid">
              <h2>Select Event to Edit</h2>
              <div className="events-grid">
                {EVENTS.map((event) => (
                    <button key={event.id} onClick={() => setEditingEvent(event)} className="event-button">
                      <div className="event-name">{event.name}</div>
                      <div className="event-status">Edit Scores</div>
                    </button>
                ))}
              </div>
            </div>
        )}
      </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function OeklympicsApp() {
  const [user, setUser] = useState(null);
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const scoresRef = ref(database, 'scores');
    const unsubscribeScores = onValue(
        scoresRef,
        (snapshot) => {
          setScores(snapshot.exists() ? snapshot.val() : {});
        },
        (err) => {
          console.error('Firebase read error:', err);
        }
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsubscribeScores();
      unsubscribeAuth();
    };
  }, []);

  const handleLogout = () => {
    signOut(auth);
    setShowLogin(false);
  };

  if (loading) {
    return <div className="loading">Loading Öklympics...</div>;
  }

  if (user) {
    return (
        <div className="app-wrapper admin-bg">
          <AdminDashboard user={user} scores={scores} onLogout={handleLogout} />
        </div>
    );
  }

  if (showLogin) {
    return (
        <div className="app-wrapper admin-bg">
          <AdminLogin onBack={() => setShowLogin(false)} />
        </div>
    );
  }

  return (
      <div className="app-wrapper">
        <Leaderboard scores={scores} />
        <button className="admin-fab" onClick={() => setShowLogin(true)}>
          🔐 Admin
        </button>
      </div>
  );
}