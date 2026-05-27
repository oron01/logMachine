'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, onSnapshot, collection, query, addDoc, writeBatch } from 'firebase/firestore';
import styles from './page.module.css';

// --- HAND-CRAFTED COZY RETRO SVG ICONS ---
const PixelHeart = ({ color = "#8ea594", className = "", style = {} }) => (
  <svg viewBox="0 0 11 11" className={className} style={{ shapeRendering: 'crispEdges', width: '16px', height: '16px', ...style }}>
    <path fill={color} d="M2,1 h2 v1 h-2 z M7,1 h2 v1 h-2 z M1,2 h4 v1 h-4 z M6,2 h4 v1 h-4 z M0,3 h11 v3 h-11 z M1,6 h9 v1 h-9 z M2,7 h7 v1 h-7 z M3,8 h5 v1 h-5 z M4,9 h3 v1 h-3 z M5,10 h1 v1 h-1 z" />
  </svg>
);
const PixelStar = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" className={className} style={{ shapeRendering: 'crispEdges' }}><path fill="currentColor" d="M7,0 h1 v3 h3 v1 h-3 v3 h3 v1 h-3 v3 h-1 v-3 h-3 v-1 h3 v-3 h-3 v-1 h3 z" /><rect x="2" y="5" width="11" height="5" fill="currentColor" /><rect x="5" y="2" width="5" height="11" fill="currentColor" /><rect x="1" y="6" width="13" height="3" fill="currentColor" /><rect x="6" y="1" width="3" height="13" fill="currentColor" /></svg>
);
const PixelCloud = ({ className = "" }) => (
  <svg viewBox="0 0 24 14" className={className} style={{ shapeRendering: 'crispEdges', width: '64px', height: '40px' }}><rect x="6" y="2" width="6" height="2" fill="#ffffff" /><rect x="4" y="4" width="10" height="2" fill="#ffffff" /><rect x="14" y="4" width="4" height="2" fill="#ffffff" /><rect x="2" y="6" width="18" height="2" fill="#ffffff" /><rect x="18" y="6" width="4" height="2" fill="#ffffff" /><rect x="0" y="8" width="24" height="4" fill="#ffffff" /><rect x="2" y="12" width="20" height="2" fill="#ffffff" /></svg>
);
const PixelShootingStar = () => (
  <svg viewBox="0 0 24 24" style={{ shapeRendering: 'crispEdges', width: '56px', height: '56px', flexShrink: 0 }}><rect x="14" y="4" width="2" height="2" fill="#fbe37d" /><rect x="12" y="6" width="6" height="2" fill="#fbe37d" /><rect x="10" y="8" width="10" height="2" fill="#fbe37d" /><rect x="12" y="10" width="6" height="2" fill="#fbe37d" /><rect x="14" y="12" width="2" height="2" fill="#fbe37d" /><rect x="12" y="4" width="2" height="2" fill="#fbe37d" /><rect x="16" y="6" width="2" height="2" fill="#fbe37d" /><rect x="6" y="10" width="4" height="2" fill="#a497c6" /><rect x="4" y="12" width="4" height="2" fill="#a497c6" /><rect x="2" y="14" width="4" height="2" fill="#a497c6" /><rect x="10" y="14" width="2" height="2" fill="#a497c6" /><rect x="8" y="16" width="4" height="2" fill="#a497c6" /><rect x="6" y="18" width="4" height="2" fill="#a497c6" /></svg>
);

// --- FIREBASE DETECTOR CLIENT ---
const getFirebaseClient = () => {
  const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  const envConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG ? JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG) : null;
  const activeConfig = config || envConfig;

  if (!activeConfig || !activeConfig.apiKey) return null;
  try {
    const app = initializeApp(activeConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { auth, db };
  } catch (e) {
    console.warn("Firebase Init failed, running in Offline Cache mode.", e);
    return null;
  }
};

const firebaseApp = getFirebaseClient();
const auth = firebaseApp?.auth;
const db = firebaseApp?.db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'proof-log-app';

export default function App() {
  // SSR Hydration Safeguard Mount
  const [mounted, setMounted] = useState(false);

  // Core Categories & Habits Configuration
  const DEFAULT_CATEGORIES = ["PHYSICAL", "MENTAL", "ASSETS", "BUILD", "SOCIAL", "SKILL"];
  
  const DEFAULT_HABITS = [
    { id: 'hc-1', name: 'READING' },
    { id: 'hc-2', name: 'MEDITATE' },
    { id: 'hc-3', name: 'WORKOUT' },
    { id: 'hc-4', name: 'CODING' }
  ];

  // Core States
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);
  const [proofs, setProofs] = useState([]);
  const [habits, setHabits] = useState([]);
  const [isOnline, setIsOnline] = useState(false);

  const getLocalTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  
  const [currentDateStr, setCurrentDateStr] = useState(getLocalTodayString());

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Logic (Online Firebase / Local fallback)
  const fetchProofs = async (userId) => {
    if (db && isOnline) {
      try {
        const { data, error } = await supabase
          .from('daily_proofs')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data) {
          setProofs(data);
          return;
        }
      } catch (e) {
        console.warn("Failed retrieving from Supabase, loading localStorage cache:", e);
      }
    }
    
    const localData = JSON.parse(localStorage.getItem('proof_logs') || '[]');
    const userSpecific = localData.filter(p => p.user_id === userId);
    setProofs(userSpecific);
  };

  const fetchHabits = async (userId) => {
    if (db && isOnline) {
      try {
        const { data, error } = await supabase
          .from('habits')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data) {
          setHabits(data);
          return;
        }
      } catch (e) {
        console.warn("Failed retrieving habits from Supabase, loading localStorage cache:", e);
      }
    }
    
    const localData = JSON.parse(localStorage.getItem('custom_habits') || '[]');
    const userSpecific = localData.filter(h => h.user_id === userId);
    setHabits(userSpecific);
  };

  // AUTH LIFECYCLE
  useEffect(() => {
    if (!mounted) return;

    const performAuth = async () => {
      if (auth) {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
            setIsOnline(true);
            return;
          } else {
            await signInAnonymously(auth);
            setIsOnline(true);
            return;
          }
        } catch (e) {
          console.warn("Firebase Auth error. Entering local mock storage guest engine.", e);
        }
      }

      // Guest Caching Fallback Engine
      setIsOnline(false);
      let guestId = localStorage.getItem('proof_log_guest_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('proof_log_guest_id', guestId);
      }
      const mockUser = { uid: guestId, id: guestId, email: 'guest@prooflog.local' };
      setUser(mockUser);
      
      // Load offline local storage caches
      const localProofs = JSON.parse(localStorage.getItem('proof_logs') || '[]');
      setProofs(localProofs.filter(p => p.user_id === mockUser.id));

      const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');
      setHabits(localHabits.filter(h => h.user_id === mockUser.id));
      setStatus("loaded");
    };

    performAuth();
  }, [mounted, isOnline]);

  // Auth observer subscription
  useEffect(() => {
    if (!mounted || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
        setIsOnline(true);
        setStatus("loaded");
      }
    });
    return () => unsubscribe();
  }, [mounted]);

  // Firestore Snapshot subscription: proofs collection
  useEffect(() => {
    if (!user) return;

    if (db && isOnline) {
      const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_proofs'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProofs(data);
      });
      return () => unsubscribe();
    } else {
      const localProofs = JSON.parse(localStorage.getItem('proof_logs') || '[]');
      setProofs(localProofs.filter(p => p.user_id === user.uid));
    }
  }, [user, isOnline]);

  // Firestore Snapshot subscription: custom habits
  useEffect(() => {
    if (!user) return;

    if (db && isOnline) {
      const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.created_at.localeCompare(b.created_at));
        setHabits(data);
      });
      return () => unsubscribe();
    } else {
      const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');
      setHabits(localHabits.filter(h => h.user_id === user.uid));
    }
  }, [user, isOnline]);

  // Combine habits
  const displayHabits = useMemo(() => {
    return [
      ...DEFAULT_HABITS,
      ...habits.filter(h => !DEFAULT_HABITS.find(dh => dh.name === h.name))
    ];
  }, [habits, habits.length]);

  // Sort and filter active day proofs
  const currentDayProofs = useMemo(() => {
    return proofs
      .filter(p => p.proof_date === currentDateStr)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [proofs, currentDateStr]);

  // Streaks logic
  const streak = useMemo(() => {
    if (!proofs.length) return 0;
    const dates = [...new Set(proofs.map(p => p.proof_date))].sort((a, b) => b.localeCompare(a));
    let currentStreak = 0;
    
    let checkDate = new Date();
    const todayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
    
    let hasToday = dates.includes(todayStr);
    if (!hasToday && !dates.includes(yesterdayStr)) return 0;
    
    checkDate = new Date();
    if (!hasToday) checkDate.setDate(checkDate.getDate() - 1);
    
    while (true) {
      const checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (dates.includes(checkStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return currentStreak;
  }, [proofs]);

  // Day Number from the first logged date
  const dayNumber = useMemo(() => {
    if (!proofs.length) return 1;
    const dates = proofs.map(p => p.proof_date).sort();
    const firstDate = new Date(dates[0].split('-')[0], dates[0].split('-')[1] - 1, dates[0].split('-')[2]);
    const current = new Date(currentDateStr.split('-')[0], currentDateStr.split('-')[1] - 1, currentDateStr.split('-')[2]);
    firstDate.setHours(0,0,0,0);
    current.setHours(0,0,0,0);
    const diffDays = Math.floor((current - firstDate) / (1000 * 60 * 60 * 24)); 
    return diffDays >= 0 ? diffDays + 1 : 1; 
  }, [proofs, currentDateStr]);

  // Count unsynced offline cache accomplishments & habits
  const localUnsyncedCount = useMemo(() => {
    if (!mounted) return 0;
    const localProofs = JSON.parse(localStorage.getItem('proof_logs') || '[]');
    const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');
    return localProofs.length + localHabits.length;
  }, [proofs, habits, mounted]);

  // Database additions implementation
  const handleAddProof = async (inputText, category) => {
    if (!inputText.trim() || !user) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newProof = {
      proof_date: currentDateStr,
      time_added: timeStr,
      category: category,
      proof_text: inputText.trim(),
      created_at: now.toISOString()
    };

    if (db && isOnline) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_proofs'), newProof);
        return;
      } catch (e) {
        console.warn("Firestore insertion failed, caching locally instead:", e);
      }
    }

    // LocalStorage Caching Fallback
    const localData = JSON.parse(localStorage.getItem('proof_logs') || '[]');
    const localItem = {
      id: 'local_' + Math.random().toString(36).substring(2, 15),
      user_id: user.uid,
      ...newProof
    };
    localData.push(localItem);
    localStorage.setItem('proof_logs', JSON.stringify(localData));
    setProofs(prev => [...prev, localItem]);
  };

  // Database deletions implementation
  const handleDeleteProof = async (id) => {
    if (!user) return;

    if (db && isOnline) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'daily_proofs', id));
        return;
      } catch (e) {
        console.warn("Firestore delete failed, removing locally:", e);
      }
    }

    const localData = JSON.parse(localStorage.getItem('proof_logs') || '[]');
    const filtered = localData.filter(p => p.id !== id);
    localStorage.setItem('proof_logs', JSON.stringify(filtered));
    setProofs(prev => prev.filter(p => p.id !== id));
  };

  // Deletion logic for custom habits
  const handleHabitDelete = async (id) => {
    if (!user) return;

    if (db && isOnline) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'habits', id));
        return;
      } catch (e) {
        console.warn("Deleting habit in Firestore failed, deleting locally:", e);
      }
    }

    const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');
    const filtered = localHabits.filter(h => h.id !== id);
    localStorage.setItem('custom_habits', JSON.stringify(filtered));
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  // ACID transaction batch cache sync to Firestore
  const syncLocalCacheToDb = async () => {
    if (!user || !db || !isOnline) return;
    const localProofs = JSON.parse(localStorage.getItem('proof_logs') || '[]');
    const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');

    if (localProofs.length === 0 && localHabits.length === 0) return;

    setStatus("loading");
    try {
      const batch = writeBatch(db);

      // Map offline proofs
      localProofs.forEach(p => {
        const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_proofs'));
        batch.set(ref, {
          proof_date: p.proof_date,
          time_added: p.time_added,
          category: p.category,
          proof_text: p.proof_text,
          created_at: p.created_at
        });
      });

      // Map offline habits
      localHabits.forEach(h => {
        const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'));
        batch.set(ref, {
          name: h.name,
          created_at: h.created_at
        });
      });

      await batch.commit();

      localStorage.setItem('proof_logs', '[]');
      localStorage.setItem('custom_habits', '[]');

      alert("Successfully synced all offline wins & custom habits to Firestore database!");
      
      // Reload states
      fetchProofs(user.uid);
      fetchHabits(user.uid);
    } catch (e) {
      console.error("Batch sync to Firestore failed", e);
      alert("Database sync failed: " + e.message);
    }
    setStatus("loaded");
  };

  // Save-File Exporting logic
  const handleExportSave = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      proofs: proofs,
      habits: habits
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `proof_log_save_${currentDateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Save-File Importing logic
  const handleImportSave = (e) => {
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const importedProofs = parsed.proofs || [];
        const importedHabits = parsed.habits || [];
        
        if (!Array.isArray(importedProofs) || !Array.isArray(importedHabits)) {
          alert("Invalid save file format!");
          return;
        }

        setStatus("loading");
        
        if (db && isOnline) {
          // Online Batch Import commit
          const batch = writeBatch(db);
          
          importedProofs.forEach(p => {
            const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_proofs'));
            batch.set(ref, {
              proof_date: p.proof_date,
              time_added: p.time_added,
              category: p.category || 'None',
              proof_text: p.proof_text,
              created_at: p.created_at || new Date().toISOString()
            });
          });

          importedHabits.forEach(h => {
            const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'));
            batch.set(ref, {
              name: h.name.toUpperCase(),
              created_at: h.created_at || new Date().toISOString()
            });
          });

          await batch.commit();
        } else {
          // Local offline merge cache
          const localProofs = JSON.parse(localStorage.getItem('proof_logs') || '[]');
          const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');

          const mergedProofs = [...importedProofs, ...localProofs];
          const uniqueProofs = [];
          const seenProofs = new Set();
          mergedProofs.forEach(p => {
            const key = `${p.proof_date}_${p.proof_text}`;
            if (!seenProofs.has(key)) {
              seenProofs.add(key);
              uniqueProofs.push({
                id: p.id || 'local_' + Math.random().toString(36).substring(2, 15),
                user_id: user.uid,
                proof_date: p.proof_date,
                time_added: p.time_added,
                category: p.category,
                proof_text: p.proof_text,
                created_at: p.created_at
              });
            }
          });

          const mergedHabits = [...importedHabits, ...localHabits];
          const uniqueHabits = [];
          const seenHabits = new Set();
          mergedHabits.forEach(h => {
            const key = h.name.toUpperCase();
            if (!seenHabits.has(key)) {
              seenHabits.add(key);
              uniqueHabits.push({
                id: h.id || 'local_habit_' + Math.random().toString(36).substring(2, 15),
                user_id: user.uid,
                name: key,
                created_at: h.created_at
              });
            }
          });

          localStorage.setItem('proof_logs', JSON.stringify(uniqueProofs));
          localStorage.setItem('custom_habits', JSON.stringify(uniqueHabits));
        }

        alert("Save file imported successfully!");
        
        if (user) {
          await fetchProofs(user.uid);
          await fetchHabits(user.uid);
        }
      } catch (err) {
        alert("Import failed: " + err.message);
      }
      setStatus("loaded");
    };
    
    if (e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
    }
  };

  // --- COLLAPSIBLE INNER RENDER COMPONENT FUNCTIONS ---

  function BackgroundScene() {
    return (
      <div className={`${styles.backgroundScene}`}>
        <div className={`${styles.bgItem} ${styles.pulsing}`} style={{ top: '8%', left: '15%', color: '#fbe37d' }}><PixelStar size={45} /></div>
        <div className={`${styles.bgItem}`} style={{ top: '25%', right: '10%', color: '#fbe37d', opacity: 0.8 }}><PixelStar size={25} /></div>
        <div className={`${styles.bgItem}`} style={{ bottom: '15%', left: '25%', color: '#fbe37d', opacity: 0.9 }}><PixelStar size={35} /></div>
        <div className={`${styles.bgItem}`} style={{ top: '60%', right: '20%', color: '#fbe37d', opacity: 0.6 }}><PixelStar size={15} /></div>
        <div className={`${styles.bgItem}`} style={{ top: '35%', left: '5%', opacity: 0.8, transform: 'rotate(12deg) scale(2)' }}><PixelHeart color="#dfb8eb" /></div>
        <div className={`${styles.bgItem}`} style={{ top: '15%', right: '30%', opacity: 0.9, transform: 'rotate(-12deg) scale(1.5)' }}><PixelHeart color="#dfb8eb" /></div>
        <div className={`${styles.bgItem}`} style={{ bottom: '25%', right: '8%', opacity: 0.7, transform: 'rotate(6deg) scale(1.8)' }}><PixelHeart color="#dfb8eb" /></div>
        <div className={`${styles.bgItem}`} style={{ top: '10%', right: '15%', opacity: 0.7, transform: 'scale(1.25)' }}><PixelCloud /></div>
        <div className={`${styles.bgItem}`} style={{ bottom: '10%', left: '5%', opacity: 0.6, transform: 'scale(1.5)' }}><PixelCloud /></div>
      </div>
    );
  }

  function Header() {
    const [exportBtnText, setExportBtnText] = useState("[COPY TXT]");

    const handlePrevDay = () => {
      const [y, m, d] = currentDateStr.split('-');
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - 1);
      setCurrentDateStr(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    };

    const handleNextDay = () => {
      const [y, m, d] = currentDateStr.split('-');
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + 1);
      const nextDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (nextDateStr <= getLocalTodayString()) {
        setCurrentDateStr(nextDateStr);
      }
    };

    const handleExport = () => {
      if (!proofs.length) return;
      const grouped = proofs.reduce((acc, p) => {
        if(!acc[p.proof_date]) acc[p.proof_date] = [];
        acc[p.proof_date].push(p);
        return acc;
      }, {});
      
      const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));
      let out = "--- PROOF LOG ---\n\n";
      sortedDates.forEach(date => {
         out += `[ DATE: ${date} ]\n`;
         grouped[date].sort((a,b) => a.time_added.localeCompare(b.time_added)).forEach(p => {
             out += `- [${p.category}] ${p.proof_text} (${p.time_added})\n`;
         });
         out += `\n`;
      });
      
      navigator.clipboard.writeText(out);

      setExportBtnText("[COPIED!]");
      setTimeout(() => setExportBtnText("[COPY TXT]"), 2000);
    };

    const displayDate = currentDateStr 
      ? new Date(currentDateStr.split('-')[0], currentDateStr.split('-')[1] - 1, currentDateStr.split('-')[2])
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '';

    const isToday = currentDateStr === getLocalTodayString();

    return (
      <div className={`${styles.header}`}>
        <div className={`${styles.headerTitleWrap}`}>
          <div className={`${styles.headerTitle}`}>
            <span>DAY</span>
            <span>{String(dayNumber).padStart(3, '0')}</span>
          </div>
          <button onClick={handleExport} className={`${styles.exportBtn}`}>{exportBtnText}</button>
        </div>
        <div className={`${styles.headerDateWrap}`}>
          <button onClick={handlePrevDay} className={`${styles.dateNavBtn}`}>{'<'}</button>
          <span className={`${styles.headerDate}`}>{displayDate}</span>
          <button onClick={handleNextDay} disabled={isToday} className={`${styles.dateNavBtn}`}>{'>'}</button>
        </div>
      </div>
    );
  }

  function TodayProofsList() {
    return (
      <div className={`${styles.listWrapper}`}>
        <div className={`${styles.listHeader}`}>
          <div className={`${styles.listTitle}`}>
            <PixelHeart color="#8da592" /> 
            <span>{currentDateStr === getLocalTodayString() ? "TODAY'S PROOFS" : "LOGGED PROOFS"}</span>
          </div>
          <span className={`${styles.listCount}`}>{String(currentDayProofs.length).padStart(2, '0')}</span>
        </div>
        <div className={`${styles.listScrollArea}`}>
          {currentDayProofs.map((proof) => (
            <div key={proof.id} className={`${styles.listItem}`}>
              <div className={`${styles.listItemTextWrap}`}>
                <PixelHeart color="#8da592" style={{flexShrink: 0}} />
                <span className={`${styles.listItemText}`}>{proof.proof_text}</span>
              </div>
              <div className={`${styles.listItemTimeWrap}`}>
                <span className={`${styles.listItemTime}`}>{proof.time_added}</span>
                <button onClick={() => handleDeleteProof(proof.id)} className={`${styles.deleteBtn}`}>X</button>
              </div>
            </div>
          ))}
          {currentDayProofs.length === 0 && (
            <div className={`${styles.emptyState}`}>
              {currentDateStr === getLocalTodayString() ? "Ready to log today's wins!" : "No proofs logged on this day."}
            </div>
          )}
        </div>
      </div>
    );
  }

  function InputRow() {
    const [inputText, setInputText] = useState("");
    const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);

    const handleAdd = () => {
      handleAddProof(inputText, category);
      setInputText("");
    };

    return (
      <div className={`${styles.inputRow}`}>
        <div className={`${styles.categorySelectWrap}`}>
          <PixelHeart color="#8da592" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${styles.categorySelect}`}>
            {DEFAULT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className={`${styles.categoryArrow}`}>▼</div>
        </div>
        <input 
          type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className={`${styles.inputField}`} placeholder="what did you complete?"
        />
        <button onClick={handleAdd} className={`${styles.addBtn}`}>
          <span style={{ fontSize: '32px', lineHeight: '1', marginBottom: '4px', fontWeight: 'bold' }}>+</span>
        </button>
      </div>
    );
  }

  function HabitRow() {
    const [amount, setAmount] = useState(1);
    const [unit, setUnit] = useState("mins");
    const [note, setNote] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [newHabit, setNewHabit] = useState("");
    const scrollRef = useRef(null);

    const handleHabitAdd = async (habitName) => {
      if (!user) return;
      const finalProofText = note.trim() 
        ? `${habitName} ${amount} ${unit} - ${note.trim()}` 
        : `${habitName} ${amount} ${unit}`;

      await handleAddProof(finalProofText, 'LIFE');
      setAmount(1);
      setNote(""); // Reset note
    };

    const handleSaveNewHabit = async () => {
      if (!newHabit.trim() || !user) {
        setIsAdding(false);
        return;
      }
      const upperName = newHabit.trim().toUpperCase();

      const newHabitObj = {
        name: upperName,
        created_at: new Date().toISOString()
      };

      if (db && isOnline) {
        try {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'habits'), newHabitObj);
          setNewHabit("");
          setIsAdding(false);
          return;
        } catch (e) {
          console.warn("Adding custom habit to Firestore failed, saving locally:", e);
        }
      }

      // LocalFallback
      const localHabits = JSON.parse(localStorage.getItem('custom_habits') || '[]');
      const localItem = {
        id: 'local_habit_' + Math.random().toString(36).substring(2, 15),
        user_id: user.uid,
        ...newHabitObj
      };
      localHabits.push(localItem);
      localStorage.setItem('custom_habits', JSON.stringify(localHabits));
      setHabits(prev => [...prev, localItem].sort((a,b) => a.created_at.localeCompare(b.created_at)));
      
      setNewHabit("");
      setIsAdding(false);
    };

    const handleScroll = (direction) => {
      if (scrollRef.current) {
        const scrollAmount = 150;
        scrollRef.current.scrollBy({
          left: direction === 'left' ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
      }
    };

    return (
      <div className={`${styles.habitRow}`}>
        <div className={`${styles.habitTop}`}>
          <div className={`${styles.habitControls}`}>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className={`${styles.habitQty}`}
              min="1"
            />
            <div className={`${styles.habitUnitWrap}`}>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${styles.habitUnit}`}>
                <option value="mins">MINS</option>
                <option value="hrs">HRS</option>
                <option value="qty">QTY</option>
                <option value="pages">PAGES</option>
                <option value="km">KM</option>
                <option value="sets">SETS</option>
              </select>
              <div className={`${styles.habitUnitArrow}`}>▼</div>
            </div>
          </div>
          
          <div className={`${styles.habitNoteWrap}`}>
             <input 
               type="text" 
               value={note}
               onChange={(e) => setNote(e.target.value)}
               placeholder="NOTE (OPTIONAL)"
               className={`${styles.habitNote}`}
             />
          </div>
        </div>
        
        <div className={`${styles.habitScrollWrapper}`}>
          <button onClick={() => handleScroll('left')} className={`${styles.habitNavBtn}`}>{'<'}</button>
          
          <div className={`${styles.habitScroll}`} ref={scrollRef}>
            {displayHabits.map(h => (
              <div key={h.id} className={styles.habitBtnContainer}>
                <button 
                  onClick={() => handleHabitAdd(h.name)}
                  className={`${styles.habitTextBtn}`}
                >
                  {h.name}
                </button>
                {!DEFAULT_HABITS.find(dh => dh.id === h.id) && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleHabitDelete(h.id); }}
                    className={styles.habitDeleteBtn}
                    title="Delete custom habit"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          
            {isAdding ? (
              <input 
                autoFocus
                type="text"
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNewHabit()}
                onBlur={handleSaveNewHabit}
                className={`${styles.habitNewInput}`}
                placeholder="NAME..."
              />
            ) : (
              <button onClick={() => setIsAdding(true)} className={`${styles.habitAddBtn}`}>+</button>
            )}
          </div>

          <button onClick={() => handleScroll('right')} className={`${styles.habitNavBtn}`}>{'>'}</button>
        </div>
      </div>
    );
  }

  function SaveManager() {
    return (
      <div className={styles.saveManagerRow}>
        <button onClick={handleExportSave} className={styles.saveBtnHalf}>
          💾 EXPORT SAVE
        </button>
        <label className={styles.saveBtnHalf} style={{ textAlign: 'center' }}>
          📂 IMPORT SAVE
          <input 
            type="file" 
            accept=".json" 
            onChange={handleImportSave} 
            style={{ display: 'none' }} 
          />
        </label>
      </div>
    );
  }

  function StreakFooter() {
    return (
      <div className={`${styles.footer}`}>
        <div className={`${styles.streakWrap}`}>
          <div className={`${styles.streakLabel}`}>
            <PixelHeart color="#a497c6" /> STREAK
          </div>
          <div className={`${styles.streakNumber}`}>
            <span className={`${styles.streakValue}`}>{String(streak).padStart(2, '0')}</span>
            <span className={`${styles.streakText}`}>DAYS</span>
          </div>
        </div>
        <div className={`${styles.footerCenter}`}><PixelShootingStar /></div>
        <div className={`${styles.footerRightText}`}>
          <span>NO BLANK DAYS</span><span>KEEP IT UP!</span>
        </div>
      </div>
    );
  }

  // --- RENDERING VIEWS ---

  if (!mounted || status === "loading") {
    return (
      <div className={`${styles.loading} ${styles.pixelFontCaps}`}>
        <div className={styles.pulsing}>Loading App...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles.pixelFontCaps}`}>
      {/* Absolute top container for Status Banner and Save Manager */}
      <div 
        style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          zIndex: 150,
          width: '320px',
          maxWidth: '90%'
        }}
      >
        {/* Offline/Online status indicator */}
        {!isOnline ? (
          <div 
            style={{
              background: '#f2efe2',
              border: '2px solid #8da592',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '16px',
              color: '#3a3832',
              fontFamily: 'var(--font-vt323), monospace',
              boxShadow: '0 2px 0 rgba(0,0,0,0.15)',
              textAlign: 'center',
              width: '100%'
            }}
          >
            🟢 LOCAL OFFLINE ACTIVE
          </div>
        ) : (
          <div 
            style={{
              background: '#e6f5ed',
              border: '2px solid #8da592',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '16px',
              color: '#3a3832',
              fontFamily: 'var(--font-vt323), monospace',
              boxShadow: '0 2px 0 rgba(0,0,0,0.15)',
              textAlign: 'center',
              width: '100%'
            }}
          >
            🟢 CLOUD DATABASE CONNECTED
          </div>
        )}

        {/* Save-File Manager positioned cleanly outside the main logger card! */}
        <SaveManager />
      </div>

      <BackgroundScene />
      <div className={`${styles.mainCard}`} style={{ marginTop: '90px' }}>
        <Header />
        <TodayProofsList />
        <InputRow />
        <HabitRow />
        {localUnsyncedCount > 0 && isOnline && (
          <button onClick={syncLocalCacheToDb} className={styles.syncCacheBtn}>
            SYNC {localUnsyncedCount} OFFLINE LOGS TO CLOUD DATABASE
          </button>
        )}
        <StreakFooter />
      </div>
    </div>
  );
}
