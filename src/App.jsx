import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, query,
  onSnapshot, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut
} from 'firebase/auth';
import {
  Play, Save, Trash2, Code2,
  Loader2, Layers, ChevronRight, ChevronDown,
  LogOut, Box, List as ListIcon, AlertTriangle, GripVertical, ArrowDown,
  Wand2, BrainCircuit
} from 'lucide-react';

/**
 * --- ERROR BOUNDARY ---
 * Prevents the entire app from crashing if a UI component fails.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("UI Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-400 bg-slate-900 h-screen flex items-center justify-center">Something went wrong. Please refresh.</div>;
    }
    return this.props.children;
  }
}

/**
 * --- FIREBASE CONFIGURATION ---
 */
// In production, these are injected by the build environment or environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'kode-it';

/**
 * --- CONSTANTS ---
 */
const LANGUAGES = {
  javascript: { name: 'JavaScript', version: '18.15.0', icon: 'JS', color: 'text-yellow-400', keywords: ['function', 'return', 'console', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'class', 'extends', 'import', 'export', 'default', 'async', 'await', 'new', 'this', 'try', 'catch'] },
  cpp: { name: 'C++', version: '10.2.0', icon: 'C++', color: 'text-blue-600', keywords: ['int', 'float', 'double', 'char', 'void', 'return', 'cout', 'cin', 'if', 'else', 'for', 'while', 'class', 'struct', 'public', 'private', 'include', 'std', 'vector', 'string', 'map', 'unordered_map'] },
  java: { name: 'Java', version: '15.0.2', icon: 'JV', color: 'text-orange-400', keywords: ['public', 'static', 'void', 'main', 'class', 'int', 'String', 'System', 'out', 'println', 'if', 'else', 'for', 'while', 'new', 'return', 'extends', 'implements', 'ArrayList', 'HashMap'] },
  python: { name: 'Python', version: '3.10.0', icon: 'PY', color: 'text-blue-400', keywords: ['def', 'return', 'print', 'if', 'else', 'elif', 'for', 'in', 'range', 'class', 'import', 'from', 'as', 'pass', 'break', 'continue'] },
};

// CLEAN BOILERPLATE CODE
const DEFAULT_CODE = {
  javascript: `// JavaScript\nconsole.log("Hello, World!");\n\nfunction add(a, b) {\n    return a + b;\n}\n\nconsole.log("Sum: " + add(5, 10));`,
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
  python: `print("Hello, World!")`
};

/**
 * --- TRANSPILER (C++/Java -> JS) ---
 */
const transpileToJs = (code, lang) => {
  if (lang === 'javascript') return code;

  let jsCode = code;

  // 1. Remove Headers & Imports
  jsCode = jsCode.replace(/#include\s+<.*>/g, '')
    .replace(/using\s+namespace\s+std;/g, '')
    .replace(/import\s+.*;/g, '')
    .replace(/package\s+.*;/g, '');

  // 2. Remove Modifiers
  jsCode = jsCode.replace(/\b(public|private|protected|static|final|volatile|const)\b/g, '');

  // 3. Remove Generics (Recursive)
  let prev;
  do {
    prev = jsCode;
    jsCode = jsCode.replace(/<[^<>]*>/g, '');
  } while (prev !== jsCode);

  // 4. Data Structures
  // 2D Array Init: { {1,2}, {3,4} } -> [ [1,2], [3,4] ]
  jsCode = jsCode.replace(/(\w+)\s*=\s*(\{[\s\S]*?\});/g, (match, name, content) => {
    let arr = content;
    while (arr.includes('{')) {
      arr = arr.replace(/\{/g, '[').replace(/\}/g, ']');
    }
    return `${name} = ${arr};`;
  });

  // Vector/Array declarations
  jsCode = jsCode.replace(/vector\s+([a-zA-Z0-9_]+)\s*\(([^,]+),([^)]+)\);/g, 'let $1 = new Array($2).fill($3);');
  jsCode = jsCode.replace(/vector\s+([a-zA-Z0-9_]+);/g, 'let $1 = [];');
  jsCode = jsCode.replace(/(\w+)\[\]\s*=/g, '$1 =');
  jsCode = jsCode.replace(/\[\]\s+(\w+)\s*=/g, ' $1 =');

  // Allocation
  jsCode = jsCode.replace(/new\s+(?:int|float|double|char|string|boolean|long)\s*\[([^\]]+)\]/g, 'new Array($1).fill(0)');
  jsCode = jsCode.replace(/new\s+(?:int|float|double|char|string|boolean|long)\s*\[([^\]]+)\]\[([^\]]+)\]/g, '[...Array($1)].map(() => Array($2).fill(0))');

  // 5. Functions
  const types = ['void', 'int', 'float', 'double', 'bool', 'boolean', 'char', 'string', 'String', 'vector', 'ArrayList', 'List', 'Map', 'HashMap', 'set', 'queue', 'stack', 'long', 'auto'];
  const typePattern = types.join('|');

  jsCode = jsCode.replace(new RegExp(`(?:${typePattern})\\s+([a-zA-Z0-9_]+)\\s*\\(([^)]*)\\)\\s*\\{`, 'g'), (match, name, args) => {
    const cleanArgs = args.replace(new RegExp(`\\b(${typePattern})\\s+`, 'g'), '').replace(/[*&]/g, '');
    return `async function ${name}(${cleanArgs}) {`;
  });

  // 6. Classes & Vars
  if (lang === 'java') {
    jsCode = jsCode.replace(/class\s+Main\s*\{/, '');
    jsCode = jsCode.replace(/}\s*$/, '');
  }
  jsCode = jsCode.replace(new RegExp(`\\b(${typePattern})\\s+`, 'g'), 'let ');

  // 7. Methods & IO
  jsCode = jsCode.replace(/\.push_back\(/g, '.push(');
  jsCode = jsCode.replace(/\.add\(/g, '.push(');
  jsCode = jsCode.replace(/\.size\(\)/g, '.length');
  jsCode = jsCode.replace(/\.length\(\)/g, '.length');
  jsCode = jsCode.replace(/\.length/g, '.length');
  jsCode = jsCode.replace(/cout\s*<<\s*(.*);/g, (m, args) => {
    const parts = args.split('<<').map(s => s.trim()).filter(s => s !== 'endl');
    return `console.log(${parts.join(',')});`;
  });
  jsCode = jsCode.replace(/System\.out\.println\((.*)\);/g, 'console.log($1);');

  // 8. Cleanup
  jsCode = jsCode.replace(/[*&]/g, '');

  if (!jsCode.includes('main()') && jsCode.includes('async function main')) {
    jsCode += '\nawait main();';
  }

  return jsCode;
};

/**
 * --- STRUCTURE ANALYZER ---
 */
const analyzeStructure = (code) => {
  const structure = [{ type: 'root', name: 'File', children: [] }];
  const lines = code.split('\n');
  let currentNesting = 0;
  let maxNesting = 0;
  let bigO = "O(1)";

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^(for|while)/.test(trimmed)) {
      currentNesting++;
      maxNesting = Math.max(maxNesting, currentNesting);
      if (trimmed.includes('*=') || trimmed.includes('/=')) bigO = "O(log n)";
    }
    if (trimmed.includes('}') && currentNesting > 0 && !trimmed.includes('{')) currentNesting--;

    const funcMatch = line.match(/(?:function|void|int|def)\s+([a-zA-Z0-9_]+)/);
    if (funcMatch) {
      structure[0].children.push({ type: 'method', name: funcMatch[1], children: [] });
    }
  });

  if (maxNesting === 1 && bigO !== "O(log n)") bigO = "O(n)";
  else if (maxNesting === 2) bigO = "O(n²)";
  else if (maxNesting >= 3) bigO = "O(n³)";

  return { structure, bigO };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [code, setCode] = useState(DEFAULT_CODE.javascript);
  const [output, setOutput] = useState([]);
  const [language, setLanguage] = useState('javascript');
  const [isRunning, setIsRunning] = useState(false);
  const [snippets, setSnippets] = useState([]);
  const [activeTab, setActiveTab] = useState('editor');
  const [sidebarTab, setSidebarTab] = useState('files');
  const [editorWidth, setEditorWidth] = useState(60);
  const isResizing = useRef(false);

  const [suggestions, setSuggestions] = useState([]);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 });

  const [visStep, setVisStep] = useState(0);
  const [visHistory, setVisHistory] = useState([]);
  const [isVisualizing, setIsVisualizing] = useState(false);

  const editorRef = useRef(null);
  const analysis = useMemo(() => analyzeStructure(code), [code, language]);

  // Auth & Data
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); }
        catch { await signInAnonymously(auth); }
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'snippets'));
    const unsub = onSnapshot(q,
      (snap) => {
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setSnippets(fetched);
      },
      (err) => setOutput([`Database Error: ${err.message}`])
    );
    return () => unsub();
  }, [user]);

  // Handlers
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { alert(`Login failed: ${e.message}`); }
  };

  const handleLanguageChange = (e) => {
    const l = e.target.value;
    setLanguage(l);
    setCode(DEFAULT_CODE[l]);
    setOutput([]);
    setVisHistory([]);
    setIsVisualizing(false);
  };

  const saveSnippet = async () => {
    if (!user || user.isAnonymous) {
      if (!confirm("You are currently a guest. Login with Google to save permanently?")) {
        // Proceed as guest if they cancel (store in anon user doc)
      } else {
        await handleLogin();
        return;
      }
    }
    const name = prompt("Enter snippet name:");
    if (!name) return;

    try {
      const uid = auth.currentUser ? auth.currentUser.uid : 'guest';
      await addDoc(collection(db, 'artifacts', appId, 'users', uid, 'snippets'), {
        title: name, code, language, createdAt: serverTimestamp()
      });
      alert("Saved successfully!");
    } catch (e) {
      alert(`Error saving: ${e.message}. Ensure you are logged in.`);
    }
  };

  const runCode = async () => {
    setIsRunning(true);
    setActiveTab('console');
    setOutput(['Running...']);

    let content = code;
    if (language === 'javascript' && (code.includes('await') || code.includes('async'))) {
      content = `(async () => {\n${code}\n})();`;
    }

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language === 'cpp' ? 'c++' : language,
          version: LANGUAGES[language].version,
          files: [{ name: language === 'java' ? 'Main.java' : undefined, content: content }],
        }),
      });
      const data = await response.json();
      if (data.message) throw new Error(data.message);
      setOutput([data.run ? (data.run.output || data.run.stderr) : 'Execution failed.']);
    } catch (e) { setOutput([`Runtime Error: ${e.message}`]); }
    finally { setIsRunning(false); }
  };

  const startVisualizer = async () => {
    if (language === 'python') return alert("Python visualization coming soon.");
    setIsVisualizing(true);
    setActiveTab('visualizer');
    setVisHistory([]);
    setVisStep(0);

    try {
      const jsCode = transpileToJs(code, language);
      const tokens = [...jsCode.matchAll(/\b[a-zA-Z_]\w*\b/g)].map(m => m[0]);
      const reserved = new Set([...LANGUAGES.javascript.keywords, 'console', 'step', 'Math', 'Array', 'Map', 'Set', 'push', 'length', 'fill', 'map', 'shift']);
      const candidates = [...new Set(tokens)].filter(t => !reserved.has(t));

      const lines = jsCode.split('\n');
      const instrumented = [];
      let braceLevel = 0;
      let inSyncFunc = false;
      let funcStartLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const open = (line.match(/\{/g) || []).length;
        const close = (line.match(/\}/g) || []).length;

        if (/\bfunction\b/.test(line) && !/\basync\b/.test(line)) {
          if (!inSyncFunc) { inSyncFunc = true; funcStartLevel = braceLevel; }
        }
        braceLevel += (open - close);
        if (inSyncFunc && braceLevel <= funcStartLevel) inSyncFunc = false;

        instrumented.push(line);

        if (line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !inSyncFunc) {
          const captureLogic = `{
                const _scope = {};
                const _candidates = ${JSON.stringify(candidates)};
                for(const c of _candidates) {
                    try {
                        const val = eval(c);
                        if (typeof val !== 'function') {
                            _scope[c] = (typeof val === 'object' && val !== null) ? JSON.parse(JSON.stringify(val, (k,v) => typeof v === 'bigint' ? v.toString() : v)) : val;
                        }
                    } catch(e) {}
                }
                await step(${i + 1}, _scope);
             }`;
          instrumented.push(captureLogic);
        }
      }

      const fullCode = `return (async () => { try { ${instrumented.join('\n')} } catch(e) { console.log("Sim Error: " + e.message); } })();`;
      const runFn = new Function('step', 'console', fullCode);
      const steps = [];

      await runFn(async (line, scope) => {
        steps.push({ line, scope });
        await new Promise(r => setTimeout(r, 0));
      }, { log: () => { } });

      if (steps.length === 0) setOutput(["No steps captured. Ensure code is valid."]);
      setVisHistory(steps);

    } catch (e) { setOutput([`Visualizer Error: ${e.message}`]); }
  };

  // --- EDITOR UTILS ---
  const startResizing = () => { isResizing.current = true; };
  const stopResizing = () => { isResizing.current = false; };
  const handleResize = (e) => {
    if (isResizing.current) {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setEditorWidth(newWidth);
    }
  };
  useEffect(() => {
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
    return () => { window.removeEventListener('mousemove', handleResize); window.removeEventListener('mouseup', stopResizing); };
  }, []);

  const handleKeyDown = (e) => {
    const { selectionStart, selectionEnd, value } = editorRef.current;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) insertSuggestion(suggestions[0]);
      else {
        const newValue = value.substring(0, selectionStart) + "    " + value.substring(selectionEnd);
        setCode(newValue);
        setTimeout(() => editorRef.current.selectionStart = editorRef.current.selectionEnd = selectionStart + 4, 0);
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(currentLineStart, selectionStart);
      const match = currentLine.match(/^(\s*)/);
      const indent = match ? match[1] : '';
      const extra = (currentLine.trim().endsWith('{') || currentLine.trim().endsWith('(')) ? '    ' : '';
      const newValue = value.substring(0, selectionStart) + '\n' + indent + extra + value.substring(selectionEnd);
      setCode(newValue);
      setTimeout(() => editorRef.current.selectionStart = editorRef.current.selectionEnd = selectionStart + 1 + indent.length + extra.length, 0);
    }
    const pairs = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const newValue = value.substring(0, selectionStart) + e.key + pairs[e.key] + value.substring(selectionEnd);
      setCode(newValue);
      setTimeout(() => editorRef.current.selectionStart = editorRef.current.selectionEnd = selectionStart + 1, 0);
    }
  };

  const handleEditorChange = (e) => {
    const val = e.target.value;
    setCode(val);
    const { selectionStart } = e.target;
    const textBefore = val.slice(0, selectionStart);
    const match = textBefore.match(/\b([a-zA-Z_]\w*)$/);
    if (match) {
      const word = match[1];
      const keys = LANGUAGES[language].keywords;
      setSuggestions(keys.filter(k => k.startsWith(word) && k !== word).slice(0, 5));
      const lines = textBefore.split('\n');
      setCursorPos({ top: lines.length * 24 + 5, left: lines[lines.length - 1].length * 8.5 + 48 });
    } else setSuggestions([]);
  };

  const insertSuggestion = (word) => {
    const { selectionStart, value } = editorRef.current;
    const textBefore = value.slice(0, selectionStart);
    const match = textBefore.match(/\b([a-zA-Z_]\w*)$/);
    if (match) {
      const prefixLen = match[1].length;
      const newValue = value.substring(0, selectionStart - prefixLen) + word + value.substring(selectionStart);
      setCode(newValue);
      setSuggestions([]);
      setTimeout(() => {
        editorRef.current.focus();
        editorRef.current.selectionStart = editorRef.current.selectionEnd = selectionStart - prefixLen + word.length;
      }, 0);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0a0a0c] text-slate-200 font-sans overflow-hidden select-none">

        {/* SIDEBAR */}
        <div className="w-64 bg-[#0F1115] border-r border-slate-800 flex flex-col shrink-0">
          <div className="h-14 flex items-center px-4 border-b border-slate-800 gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white"><Code2 size={18} /></div>
            <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">Kode It</span>
          </div>

          <div className="flex p-2 gap-1 border-b border-slate-800">
            {['files', 'structure'].map(t => <button key={t} onClick={() => setSidebarTab(t)} className={`flex-1 py-1.5 text-xs font-medium rounded capitalize ${sidebarTab === t ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>{t}</button>)}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sidebarTab === 'files' ? (
              <div className="space-y-4">
                <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex items-center justify-between">
                  {user && !user.isAnonymous ? <span className="text-xs truncate">{user.displayName || 'User'}</span> : <button onClick={handleLogin} className="text-xs text-emerald-400 font-bold hover:underline">Sign In</button>}
                  {user && !user.isAnonymous && <button onClick={() => signOut(auth)}><LogOut size={12} className="text-slate-500" /></button>}
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">My Library</h3>
                  {snippets.length === 0 && <p className="text-[10px] text-slate-600 italic">No snippets found.</p>}
                  {snippets.map(s => (
                    <div key={s.id} className="group flex items-center justify-between p-2 rounded hover:bg-slate-800 cursor-pointer text-sm mb-1">
                      <span onClick={() => { setCode(s.code); setLanguage(s.language); }} className="truncate flex-1 text-slate-300">{s.title}</span>
                      <button onClick={async () => { if (confirm("Del?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'snippets', s.id)) }} className="hidden group-hover:block text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-800/30 p-4 rounded border border-slate-700/50 text-center">
                  <div className="text-xs text-slate-500 mb-1">Time Complexity</div>
                  <div className="text-3xl font-black text-emerald-400 tracking-tight">{analysis.bigO}</div>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Code Flow</h3>
                  <div className="flex flex-col items-center space-y-2">
                    {analysis.structure[0].children.map((item, i) => (
                      <React.Fragment key={i}>
                        <div className="w-full bg-purple-500/10 border border-purple-500/30 rounded p-2 text-center relative group">
                          <span className="text-xs font-bold text-purple-300 block">{item.name}</span>
                          <span className="text-[9px] text-purple-400 uppercase tracking-wide">{item.type}</span>
                        </div>
                        <ArrowDown size={14} className="text-slate-600" />
                        {item.children?.map((child, j) => (
                          <React.Fragment key={j}>
                            <div className="w-3/4 bg-blue-500/10 border border-blue-500/30 rounded p-2 text-center relative">
                              <span className="text-xs font-bold text-blue-300 block">{child.name}</span>
                              <span className="text-[9px] text-blue-400 uppercase tracking-wide">{child.type}</span>
                            </div>
                            {j < item.children.length - 1 && <ArrowDown size={14} className="text-slate-600" />}
                          </React.Fragment>
                        ))}
                        {i < analysis.structure[0].children.length - 1 && <ArrowDown size={14} className="text-slate-600" />}
                      </React.Fragment>
                    ))}
                    <div className="w-20 bg-slate-800 border border-slate-600 rounded-full py-1 text-center"><span className="text-[10px] text-slate-400">End</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAIN LAYOUT */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-[#0a0a0c] border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center bg-[#161b22] rounded-md border border-slate-800">
              <div className="px-3 py-1.5 text-xs font-bold text-slate-500 border-r border-slate-800">LANG</div>
              <select value={language} onChange={handleLanguageChange} className="bg-transparent text-sm text-slate-200 outline-none px-2 py-1.5 cursor-pointer">
                {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveSnippet} className="p-2 text-slate-400 hover:text-white rounded"><Save size={16} /></button>
              <button onClick={startVisualizer} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 ${language === 'python' ? 'opacity-50 cursor-not-allowed' : 'text-slate-300'}`}>
                <Wand2 size={14} className="text-purple-400" /> Visualize <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-300 px-1 rounded uppercase">BETA</span>
              </button>
              <button onClick={runCode} disabled={isRunning} className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded shadow-sm">{isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run Code</button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* EDITOR */}
            <div style={{ width: `${editorWidth}%` }} className="relative bg-[#0d1117] flex flex-col border-r border-slate-800">
              <div className="flex-1 relative overflow-auto font-mono text-sm" style={{ lineHeight: '1.5rem' }}>
                <div className="min-h-full pointer-events-none p-4">
                  {code.split('\n').map((line, i) => (
                    <div key={i} className={`flex ${isVisualizing && visHistory[visStep]?.line === i + 1 ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''}`}>
                      <span className="w-8 text-right pr-3 text-slate-600 select-none text-xs leading-[1.5rem] shrink-0 inline-block">{i + 1}</span>
                      <span className="flex-1 opacity-0 leading-[1.5rem] whitespace-pre pl-2">{line || ' '}</span>
                    </div>
                  ))}
                </div>
                <textarea
                  ref={editorRef}
                  value={code}
                  onChange={handleEditorChange}
                  onKeyDown={handleKeyDown}
                  className="absolute inset-0 w-full h-full bg-transparent text-slate-300 caret-emerald-400 p-4 pl-[3.5rem] resize-none outline-none leading-[1.5rem] whitespace-pre font-mono"
                  spellCheck="false"
                  style={{ tabSize: 4 }}
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-50 bg-[#1e232b] border border-slate-700 rounded shadow-xl flex flex-col min-w-[140px] overflow-hidden" style={{ top: cursorPos.top, left: cursorPos.left }}>
                    <div className="px-2 py-1 text-[9px] text-slate-500 bg-slate-900 uppercase font-bold">Suggestions</div>
                    {suggestions.map((s, idx) => (
                      <button key={s} onClick={() => insertSuggestion(s)} className={`px-3 py-1.5 text-left text-xs ${idx === 0 ? 'bg-emerald-900/30 text-emerald-400' : 'text-slate-300'} hover:bg-emerald-500/20`}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div onMouseDown={startResizing} className="w-1 bg-slate-800 hover:bg-emerald-500 cursor-col-resize flex items-center justify-center transition-colors z-10"><GripVertical size={10} className="text-slate-600" /></div>

            {/* VISUALIZER / CONSOLE */}
            <div style={{ width: `${100 - editorWidth}%` }} className="bg-[#0F1115] flex flex-col min-w-[200px]">
              <div className="flex border-b border-slate-800 shrink-0">
                <button onClick={() => setActiveTab('console')} className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${activeTab === 'console' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500'}`}>CONSOLE</button>
                <button onClick={() => setActiveTab('visualizer')} className={`flex-1 py-2 text-xs font-bold border-b-2 transition-colors ${activeTab === 'visualizer' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500'}`}>VISUALIZER</button>
              </div>

              <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                {activeTab === 'console' && (
                  <div className="space-y-1">
                    {output.length > 0 ? output.map((line, i) => <div key={i} className="text-slate-300 whitespace-pre-wrap">{line}</div>)
                      : <div className="text-slate-600 italic text-center mt-10">Output will appear here...</div>}
                  </div>
                )}

                {activeTab === 'visualizer' && (
                  <div className="h-full flex flex-col gap-4">
                    {(language === 'cpp' || language === 'java') && (
                      <div className="bg-orange-500/10 border border-orange-500/30 p-2 rounded text-[10px] text-orange-200 flex items-center gap-2">
                        <AlertTriangle size={12} className="text-orange-400" />
                        EXPERIMENTAL: Simulating via JS translation.
                      </div>
                    )}

                    {isVisualizing && visHistory.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between bg-slate-800 p-2 rounded shrink-0">
                          <button onClick={() => setVisStep(s => Math.max(0, s - 1))} disabled={visStep === 0} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"><ChevronDown size={14} className="rotate-90" /></button>
                          <span className="text-slate-400">Step {visStep + 1} / {visHistory.length}</span>
                          <button onClick={() => setVisStep(s => Math.min(visHistory.length - 1, s + 1))} disabled={visStep === visHistory.length - 1} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"><ChevronRight size={14} /></button>
                        </div>

                        {/* FRAMES */}
                        <div className="flex-1 bg-[#0a0a0c] border border-slate-800 rounded p-3 overflow-auto min-h-[100px]">
                          <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2 uppercase tracking-wider text-[10px]"><ListIcon size={12} /> Frames (Stack)</h4>
                          <div className="space-y-1">
                            {visHistory[visStep]?.scope && Object.keys(visHistory[visStep].scope).length > 0 ? (
                              Object.entries(visHistory[visStep].scope).filter(([_, v]) => !Array.isArray(v) && typeof v !== 'object').map(([k, v]) => (
                                <div key={k} className="flex justify-between border-b border-slate-800/50 pb-1">
                                  <span className="text-slate-300">{k}</span>
                                  <span className="text-emerald-400 font-bold break-all">{String(v)}</span>
                                </div>
                              ))
                            ) : <div className="text-slate-600 italic">No locals</div>}
                          </div>
                        </div>

                        {/* OBJECTS */}
                        <div className="flex-1 bg-[#0a0a0c] border border-slate-800 rounded p-3 overflow-auto min-h-[150px]">
                          <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2 uppercase tracking-wider text-[10px]"><Box size={12} /> Objects (Heap)</h4>
                          <div className="space-y-4">
                            {visHistory[visStep]?.scope ? (
                              Object.entries(visHistory[visStep].scope).filter(([_, v]) => Array.isArray(v)).map(([k, v]) => (
                                <div key={k}>
                                  <div className="text-xs text-slate-400 mb-1">{k} <span className="text-slate-600">({Array.isArray(v[0]) ? `Matrix[${v.length}x${v[0].length}]` : `Array[${v.length}]`})</span></div>
                                  {Array.isArray(v[0]) ? (
                                    <div className="flex flex-col gap-1 bg-slate-900/50 p-2 rounded border border-slate-700">
                                      {v.map((row, rIdx) => (
                                        <div key={rIdx} className="flex gap-1">
                                          {row.map((cell, cIdx) => (
                                            <div key={cIdx} className="w-6 h-6 flex items-center justify-center border border-slate-700 bg-slate-800 text-[10px] text-orange-200">{String(cell)}</div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {v.map((val, idx) => (
                                        <div key={idx} className="flex flex-col items-center">
                                          <div className="w-8 h-8 flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-200 font-bold rounded-sm text-xs">{String(val)}</div>
                                          <span className="text-[9px] text-slate-600 mt-0.5">{idx}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-600 italic mt-10 text-center">
                        <BrainCircuit size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="font-bold text-slate-400">Visualizer Ready</p>
                        <p className="mt-2 text-slate-500 text-[10px] max-w-[200px] mx-auto">Supports Arrays, Matrices (DP), Recursion, and Loops.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}