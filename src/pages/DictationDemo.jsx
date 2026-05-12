import { useState, useRef, useEffect } from 'react';

/* ==========================================================================
   听写模式 v8 设计预览（"对话式"范式）· v2 更新
   - 支持多次听写 / 重新输入 / 主动揭晓答案
   - 答对后小红书风分享卡
   - 字幕行图标组演示（含 🎧 状态）
   独立页面 · 路由 /dictation-demo · 不接入真实数据
   ========================================================================== */

// ---------- 词级 diff（复用 DictationInput.jsx 逻辑）----------
function levenshtein(a, b) {
    const n = a.length, m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    let prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
        const cur = new Array(m + 1);
        cur[0] = i;
        for (let j = 1; j <= m; j++) {
            cur[j] = a[i - 1] === b[j - 1]
                ? prev[j - 1]
                : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
        }
        prev = cur;
    }
    return prev[m];
}

function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"()]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function compareSentences(userText, correctText) {
    const userWords = tokenize(userText);
    const correctWords = tokenize(correctText);
    const n = userWords.length, m = correctWords.length;
    if (n === 0 && m === 0) return [];
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = userWords[i - 1] === correctWords[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    const result = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && userWords[i - 1] === correctWords[j - 1]) {
            result.unshift({ type: 'correct', word: userWords[i - 1] });
            i--; j--;
        } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
            const u = userWords[i - 1], c = correctWords[j - 1];
            const isClose = levenshtein(u, c) <= 1 && Math.min(u.length, c.length) >= 3;
            result.unshift({ type: isClose ? 'close' : 'wrong', user: u, correct: c });
            i--; j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            result.unshift({ type: 'extra', user: userWords[i - 1] });
            i--;
        } else {
            result.unshift({ type: 'missing', correct: correctWords[j - 1] });
            j--;
        }
    }
    return result;
}

// ---------- 模拟数据 ----------
const MOCK_SENTENCES = [
    { text: "Today I'm making sourdough bread.", cn: "今天我要做酸面包。" },
    { text: "First, let's prepare the starter.", cn: "首先，我们来准备酵种。" },
    { text: "This recipe takes about three days.", cn: "这个配方大约需要三天。" },
];
const SPEAKER = 'Brittany';
const VIDEO_TITLE = 'Brittany 教你做酸面包';
const TOTAL = 37;

// ---------- 浏览器 TTS（demo 用，实际接入真音频）----------
const speakBrowser = (text, rate = 1.0) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    window.speechSynthesis.speak(u);
};

// ==========================================================================
//                              主组件
// ==========================================================================
export default function DictationDemo() {
    const [sentenceIdx, setSentenceIdx] = useState(0);
    const sentence = MOCK_SENTENCES[sentenceIdx % MOCK_SENTENCES.length];
    const positionIdx = 11 + sentenceIdx;

    const [userInput, setUserInput] = useState('');
    const [status, setStatus] = useState('writing'); // writing | correct
    const [attemptCount, setAttemptCount] = useState(0);
    const [lastDiff, setLastDiff] = useState(null);
    const [answerRevealed, setAnswerRevealed] = useState(false); // 是否已揭晓答案（仍可继续编辑）
    const [hintShown, setHintShown] = useState(false);
    const [cnShown, setCnShown] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, [sentenceIdx]);

    const handleSubmit = () => {
        if (!userInput.trim()) return;
        const result = compareSentences(userInput, sentence.text);
        const passed = result.length > 0 && result.every(r => r.type === 'correct' || r.type === 'close');
        setLastDiff(result);
        setAttemptCount(c => c + 1);
        if (passed) {
            setStatus('correct');
        }
        // 答错时：留在 writing，显示反馈（部分 or 完整），输入框继续可编辑
    };

    const handleRevealAnswer = () => {
        setAnswerRevealed(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && status === 'writing') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleNext = () => {
        setSentenceIdx(i => i + 1);
        setUserInput('');
        setStatus('writing');
        setLastDiff(null);
        setAnswerRevealed(false);
        setAttemptCount(0);
        setHintShown(false);
        setCnShown(false);
        setShowShareModal(false);
    };

    const hintText = sentence.text.split(' ')
        .map(w => w.replace(/[^a-zA-Z]/g, '')[0] || '')
        .join(' ');

    // 部分反馈（不泄露答案结构）
    const correctCount = lastDiff?.filter(r => r.type === 'correct' || r.type === 'close').length ?? 0;
    const totalCount = sentence.text.split(/\s+/).filter(Boolean).length;

    return (
        <div className="min-h-screen bg-gradient-to-b from-violet-50/40 via-white to-violet-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
            <div className="bg-violet-100/70 dark:bg-violet-900/20 border-b border-violet-200 dark:border-violet-800 px-4 py-2 text-center text-xs text-violet-700 dark:text-violet-300">
                🎨 听写模式 v8 设计预览 · v2（多次听写 + 分享卡 + 字幕图标组）
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">

                {/* ============ 状态：writing ============ */}
                {status === 'writing' && (
                    <div className="space-y-5 animate-[fadeIn_0.25s_ease-out]">

                        <div className="text-center text-xs text-gray-400 dark:text-gray-500 tracking-wider">
                            {positionIdx + 1} / {TOTAL}
                            {attemptCount > 0 && (
                                <span className="ml-2 text-amber-500">· 第 {attemptCount + 1} 次尝试</span>
                            )}
                        </div>

                        {/* 听音卡片 */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-violet-100 dark:border-gray-700 p-6 text-center">
                            <button
                                onClick={() => speakBrowser(sentence.text, 1.0)}
                                className="group inline-flex flex-col items-center gap-3 hover:scale-[1.02] active:scale-95 transition-transform"
                            >
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30 group-hover:shadow-xl transition-shadow">
                                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M6.3 2.84A1 1 0 004.5 3.66v12.68a1 1 0 001.8.82l9.6-6.34a1 1 0 000-1.64l-9.6-6.34z" />
                                    </svg>
                                </div>
                                <div className="text-base font-medium text-gray-700 dark:text-gray-200">
                                    {attemptCount === 0 ? `听 ${SPEAKER} 说` : '🔁 再听一遍'}
                                </div>
                            </button>
                            <button
                                onClick={() => speakBrowser(sentence.text, 0.7)}
                                className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-500 transition-colors inline-flex items-center gap-1"
                            >
                                🐢 慢一点听 (0.75x)
                            </button>
                        </div>

                        {/* 输入区 */}
                        <div>
                            <textarea
                                ref={inputRef}
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="💭 你听到了什么？"
                                rows={3}
                                className={`w-full p-5 text-lg border-2 rounded-2xl resize-none bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-4 transition-all
                                    ${attemptCount > 0
                                        ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-100 dark:border-amber-700 dark:focus:ring-amber-900/30'
                                        : 'border-gray-200 dark:border-gray-700 focus:border-violet-300 focus:ring-violet-100 dark:focus:ring-violet-900/30'
                                    }
                                `}
                            />
                        </div>

                        {/* 反馈区：答错后显示。未揭晓答案 = 部分反馈；已揭晓 = 完整对比 */}
                        {attemptCount > 0 && lastDiff && !answerRevealed && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center animate-[fadeIn_0.2s_ease-out]">
                                <div className="text-sm text-amber-800 dark:text-amber-300">
                                    ✨ 你听对了 <span className="font-bold text-base">{correctCount}</span> / {totalCount} 个词
                                </div>
                                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    {correctCount >= totalCount * 0.8 ? '差一点点了，再听一遍试试 →' : correctCount >= totalCount * 0.5 ? '听到了大部分，再听一遍 →' : '试试用首字母提示帮忙 ↓'}
                                </div>
                            </div>
                        )}
                        {attemptCount > 0 && lastDiff && answerRevealed && (
                            <div className="animate-[fadeIn_0.2s_ease-out]">
                                <div className="text-sm text-violet-600 dark:text-violet-400 mb-2 px-1">🎤 {SPEAKER} 说</div>
                                <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-900/10 rounded-2xl p-4 border border-violet-200 dark:border-violet-800">
                                    <DiffDisplay diff={lastDiff || []} />
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">{sentence.cn}</div>
                            </div>
                        )}

                        {/* Chip 工具栏 */}
                        <div className="flex flex-wrap gap-2 justify-center">
                            <Chip
                                icon="🔠"
                                label={hintShown ? '隐藏首字母' : '看首字母'}
                                active={hintShown}
                                onClick={() => setHintShown(v => !v)}
                            />
                            <Chip
                                icon="📖"
                                label={cnShown ? '隐藏中文' : '看中文'}
                                active={cnShown}
                                onClick={() => setCnShown(v => !v)}
                            />
                            <Chip
                                icon="⏭"
                                label="这句太难，下一句"
                                onClick={handleNext}
                                muted
                            />
                        </div>

                        {hintShown && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center animate-[fadeIn_0.2s_ease-out]">
                                <div className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">首字母</div>
                                <div className="font-mono text-lg tracking-wider text-yellow-900 dark:text-yellow-200">{hintText}</div>
                            </div>
                        )}
                        {cnShown && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-center animate-[fadeIn_0.2s_ease-out]">
                                <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">中文意思</div>
                                <div className="text-base text-blue-900 dark:text-blue-200">{sentence.cn}</div>
                            </div>
                        )}

                        {/* 主按钮 */}
                        <button
                            onClick={handleSubmit}
                            disabled={!userInput.trim()}
                            className="w-full py-4 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white text-base font-medium rounded-2xl shadow-md shadow-violet-200 dark:shadow-violet-900/20 transition-all"
                        >
                            ⏎ {attemptCount === 0 ? '提交' : '再交一次'}
                        </button>

                        {/* 看答案 / 跳过下一句 链接区 */}
                        {attemptCount > 0 && !answerRevealed && (
                            <div className="text-center">
                                <button
                                    onClick={handleRevealAnswer}
                                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors underline-offset-4 hover:underline"
                                >
                                    💬 实在听不出来，看 {SPEAKER} 说的
                                </button>
                            </div>
                        )}
                        {answerRevealed && (
                            <div className="text-center space-y-2">
                                <button
                                    onClick={handleNext}
                                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                                >
                                    跳过这句，去下一句 →
                                </button>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                    或对照答案再写一遍提交，加深印象
                                </div>
                            </div>
                        )}

                        {/* 换练法 off-ramp（揭晓答案后显示）*/}
                        {answerRevealed && (
                            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 text-center">
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">💡 这句确实有点难，换个练法？</div>
                                <button className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
                                    🎤 用跟读模式练这一句 →
                                </button>
                            </div>
                        )}

                        <div className="text-center text-xs text-gray-400">
                            按 <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded mx-1">Enter</kbd> 提交
                        </div>
                    </div>
                )}

                {/* ============ 状态：correct ============ */}
                {status === 'correct' && (
                    <div className="space-y-6 animate-[fadeIn_0.25s_ease-out] py-4 md:py-8">

                        <div className="text-center text-xs text-gray-400 dark:text-gray-500 tracking-wider">
                            {positionIdx + 1} / {TOTAL} ✓
                        </div>

                        <div className="text-center space-y-3">
                            <div className="text-5xl">✨</div>
                            <div className="text-xl font-medium text-gray-800 dark:text-gray-200">
                                {attemptCount === 1 ? '你听到她说的了！' : `第 ${attemptCount} 次，你听到了`}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-violet-50 to-emerald-50/50 dark:from-violet-900/20 dark:to-emerald-900/10 rounded-3xl p-6 border border-violet-200 dark:border-violet-800 text-center">
                            <div className="text-sm text-violet-600 dark:text-violet-400 mb-3">🎤 {SPEAKER}</div>
                            <div className="text-xl text-gray-800 dark:text-gray-100 font-medium leading-relaxed">
                                {sentence.text}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                                {sentence.cn}
                            </div>
                        </div>

                        {/* 三选操作（含分享）*/}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowShareModal(true)}
                                className="flex-1 py-3 bg-white dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-medium rounded-2xl transition-colors text-sm"
                            >
                                💌 收藏并分享
                            </button>
                            <button
                                className="flex-1 py-3 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-medium rounded-2xl transition-colors text-sm"
                            >
                                🎤 跟读
                            </button>
                            <button
                                onClick={handleNext}
                                className="flex-1 py-3 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-2xl shadow-md shadow-violet-200 dark:shadow-violet-900/20 transition-colors text-sm"
                            >
                                下一句 →
                            </button>
                        </div>
                    </div>
                )}

                {/* ============ 字幕模式图标组演示（v2 新版）============ */}
                <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        🎧 字幕模式 · 行尾图标组（含听写状态）
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        加进现有图标组（不新增前缀）→ 浅灰 = 没听写过 / 紫色 = 听写过 → 点击跳到听写模式
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                        <SubtitleRowWithIcons
                            num={1}
                            en="Apple was not prepared for the AI revolution."
                            cn="苹果没有为人工智能革命做好准备。"
                            listened={true}
                            isFav={true}
                        />
                        <SubtitleRowWithIcons
                            num={2}
                            en="They stumbled into it with cartoonish custom emojis."
                            cn="他们用卡通自定义表情符号跌跌撞撞地进入。"
                            listened={false}
                            isFav={false}
                        />
                        <SubtitleRowWithIcons
                            num={3}
                            en="They had to remove ads that promised certain features."
                            cn="他们不得不移除承诺某些功能的广告。"
                            listened={true}
                            isFav={false}
                        />
                        <SubtitleRowWithIcons
                            num={4}
                            en="But the whole point is they still have a Siri-sized hole."
                            cn="但关键是他们仍有一个 Siri 大小的漏洞。"
                            listened={false}
                            isFav={false}
                        />
                        <SubtitleRowWithIcons
                            num={5}
                            en="Apple is somehow gaining public trust."
                            cn="苹果却以某种方式赢得了公众的信任。"
                            listened={true}
                            isFav={false}
                        />
                    </div>
                    <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 px-1">
                        💡 鼠标移到 🎧 上看不同状态的 tooltip
                    </div>
                </div>

                {/* ============ Demo 控制器 ============ */}
                <div className="mt-10 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs text-gray-600 dark:text-gray-400">
                    <div className="font-medium mb-2">🛠 Demo 控制器</div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => { setStatus('writing'); setAttemptCount(0); setLastDiff(null); setUserInput(''); setAnswerRevealed(false); }} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50">
                            初始 writing
                        </button>
                        <button
                            onClick={() => {
                                const wrong = "Today I'm make sourdough";
                                setUserInput(wrong);
                                setLastDiff(compareSentences(wrong, sentence.text));
                                setAttemptCount(1);
                                setStatus('writing');
                                setAnswerRevealed(false);
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50"
                        >
                            答错 1 次（部分反馈）
                        </button>
                        <button
                            onClick={() => {
                                const wrong = "Today I'm make sourdough";
                                setUserInput(wrong);
                                setLastDiff(compareSentences(wrong, sentence.text));
                                setAttemptCount(2);
                                setStatus('writing');
                                setAnswerRevealed(true);
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50"
                        >
                            已看答案 (仍可改)
                        </button>
                        <button
                            onClick={() => {
                                setUserInput(sentence.text);
                                setLastDiff(compareSentences(sentence.text, sentence.text));
                                setAttemptCount(1);
                                setAnswerRevealed(false);
                                setStatus('correct');
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50"
                        >
                            correct (一次过)
                        </button>
                        <button onClick={() => { setAttemptCount(1); setShowShareModal(true); }} className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-200">
                            分享卡 (一次过)
                        </button>
                        <button onClick={() => { setAttemptCount(3); setShowShareModal(true); }} className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-200">
                            分享卡 (听了 3 遍)
                        </button>
                        <button onClick={handleNext} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50">
                            下一句（重置）
                        </button>
                    </div>
                </div>

            </div>

            {/* 分享卡 Modal */}
            {showShareModal && (
                <ShareModal
                    sentence={sentence}
                    speaker={SPEAKER}
                    videoTitle={VIDEO_TITLE}
                    attemptCount={attemptCount || 1}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
}

// ==========================================================================
//                              子组件
// ==========================================================================

function Chip({ icon, label, active, muted, onClick }) {
    const base = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border-2 active:scale-95';
    let style;
    if (active) {
        style = 'bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300';
    } else if (muted) {
        style = 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700';
    } else {
        style = 'bg-white border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-violet-900/20';
    }
    return (
        <button onClick={onClick} className={`${base} ${style}`}>
            <span>{icon}</span>
            <span>{label}</span>
        </button>
    );
}

function DiffDisplay({ diff }) {
    return (
        <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 text-base leading-relaxed">
            {diff.map((item, i) => {
                if (item.type === 'correct') {
                    return <span key={i} className="text-gray-700 dark:text-gray-200 font-medium">{item.word}</span>;
                }
                if (item.type === 'close') {
                    return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                            <span className="text-xs opacity-60">{item.user} →</span>
                            <span className="font-semibold">{item.correct}</span>
                        </span>
                    );
                }
                if (item.type === 'wrong') {
                    return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
                            <span className="text-xs opacity-60 line-through">{item.user}</span>
                            <span className="font-semibold">{item.correct}</span>
                        </span>
                    );
                }
                if (item.type === 'missing') {
                    return (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-semibold">
                            {item.correct}
                        </span>
                    );
                }
                if (item.type === 'extra') {
                    return <span key={i} className="text-gray-400 line-through opacity-60">{item.user}</span>;
                }
                return null;
            })}
        </div>
    );
}

// ---------- 字幕行 + 图标组（行尾）----------
function SubtitleRowWithIcons({ num, en, cn, listened, isFav }) {
    return (
        <div className="flex items-start gap-3 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 w-4 text-right flex-shrink-0">{num}</div>
            <div className="flex-1 min-w-0">
                <div className="text-base text-gray-800 dark:text-gray-200 leading-snug">{en}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">{cn}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                <IconBtn title="录音" color="text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </IconBtn>
                <IconBtn title="笔记" color="text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </IconBtn>
                <IconBtn title={isFav ? '已收藏' : '收藏'} color={isFav ? 'text-amber-400' : 'text-gray-300'}>
                    <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </IconBtn>
                <IconBtn title="本子" color="text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </IconBtn>
                {/* 🎧 听写状态图标 —— 关键改动 */}
                <IconBtn
                    title={listened ? '已听写过 · 点击重做' : '点击听写这一句'}
                    color={listened ? 'text-violet-500' : 'text-gray-300'}
                    highlight={listened}
                >
                    <svg className="w-4 h-4" fill={listened ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 00-14 0v3a2 2 0 002 2h2v-7H5m14 0h-2v7h2a2 2 0 002-2v-3" />
                    </svg>
                </IconBtn>
            </div>
        </div>
    );
}

function IconBtn({ title, color, highlight, children }) {
    return (
        <button
            title={title}
            className={`p-1.5 rounded-md transition-colors ${color} ${highlight ? 'hover:bg-violet-100 dark:hover:bg-violet-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
            {children}
        </button>
    );
}

// ---------- 分享卡 Modal（小红书风）----------
// 卡片风格主题
const CARD_THEMES = [
    { name: '暖桃', from: 'from-orange-100', via: 'via-rose-100', to: 'to-violet-100', accent: 'text-rose-500', border: 'border-rose-200' },
    { name: '静谧蓝', from: 'from-sky-50', via: 'via-blue-50', to: 'to-indigo-100', accent: 'text-indigo-500', border: 'border-indigo-200' },
    { name: '牛奶白', from: 'from-stone-50', via: 'via-amber-50', to: 'to-stone-100', accent: 'text-stone-600', border: 'border-stone-200' },
    { name: '抹茶绿', from: 'from-emerald-50', via: 'via-green-50', to: 'to-teal-100', accent: 'text-emerald-600', border: 'border-emerald-200' },
];

// 简单提取一个"学到的词"——挑句子里最长的非常用词
const COMMON_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'i', 'im', 'you', 'we', 'they', 'he', 'she', 'it', 'this', 'that', 'these', 'those', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'today', 'now', 'me', 'my', 'your', 'have', 'has', 'do', 'does', 'be', 'been', 'will', 'can', 'just', 'so', 'not', 'all', 'one', 'two', 'three', 'making', 'make', 'let', 'lets', 'first', 'days']);
function extractLearnedWord(text) {
    const words = tokenize(text).filter(w => !COMMON_WORDS.has(w) && w.length >= 4);
    if (words.length === 0) return null;
    return words.sort((a, b) => b.length - a.length)[0];
}

function formatDate(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const period = hh < 12 ? '上午' : hh < 18 ? '下午' : '晚上';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return { date: `${yyyy}.${mm}.${dd}`, time: `${period} ${h12}:${min}` };
}

function ShareModal({ sentence, speaker, videoTitle, attemptCount = 1, onClose }) {
    const [themeIdx, setThemeIdx] = useState(0);
    const theme = CARD_THEMES[themeIdx];
    const { date, time } = formatDate();
    const learnedWord = extractLearnedWord(sentence.text);

    // 模拟数据（实际接入应从 localStorage / 用户数据读）
    const todaySentenceNum = 3;
    const streakDays = 12;

    // 努力 badge 文案——这是分享卡的情绪核心
    const effortBadge = attemptCount === 1
        ? { icon: '🎧', text: '一次就听到了 🎉', highlight: true }
        : attemptCount === 2
            ? { icon: '🎧', text: `听了 ${attemptCount} 遍才听到`, highlight: false }
            : { icon: '🎧', text: `听了 ${attemptCount} 遍才听到 ❤️`, highlight: false };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl my-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                    💌 分享我的听写日记
                </div>

                {/* 卡片预览（3:4 portrait，小红书风）*/}
                <div
                    className={`aspect-[3/4] bg-gradient-to-br ${theme.from} ${theme.via} ${theme.to} rounded-2xl p-6 shadow-inner border ${theme.border} flex flex-col`}
                >
                    {/* 顶部：日期 + 视频出处（diary 感）*/}
                    <div className="space-y-1">
                        <div className="text-xs text-gray-500 dark:text-gray-400 tracking-wide">
                            {date}  ·  {time}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                            <span>📺</span>
                            <span className="truncate">{videoTitle}</span>
                        </div>
                    </div>

                    {/* 序号（打卡感）*/}
                    <div className={`mt-4 text-sm font-medium ${theme.accent}`}>
                        今天的第 {todaySentenceNum} 句 ✨
                    </div>

                    {/* 主体：英文 + 中文 */}
                    <div className="flex-1 flex flex-col justify-center my-3 min-h-0">
                        <div
                            className="text-2xl text-gray-800 dark:text-gray-100 leading-tight font-medium"
                            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
                        >
                            "{sentence.text}"
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
                            {sentence.cn}
                        </div>
                    </div>

                    {/* 努力 + 收获 badge —— 这是情绪核心 */}
                    <div className="space-y-1.5 text-sm">
                        <div className={`${effortBadge.highlight ? `${theme.accent} font-medium` : 'text-gray-700 dark:text-gray-200'}`}>
                            {effortBadge.icon} {effortBadge.text}
                        </div>
                        {learnedWord && (
                            <div className="text-gray-700 dark:text-gray-200">
                                ✨ 学到一个新词 <span className="font-semibold">"{learnedWord}"</span>
                            </div>
                        )}
                    </div>

                    {/* 品牌底栏 */}
                    <div className="mt-4 pt-3 border-t border-gray-300/40 dark:border-gray-600/40 flex items-center justify-between text-xs">
                        <div className="text-gray-500 dark:text-gray-400">
                            💜 BiuBiu 学英语
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                            第 {streakDays} 天
                        </div>
                    </div>
                </div>

                {/* 风格切换 */}
                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 dark:text-gray-400">风格：</span>
                    {CARD_THEMES.map((t, i) => (
                        <button
                            key={t.name}
                            onClick={() => setThemeIdx(i)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${themeIdx === i
                                    ? 'bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                                }`}
                        >
                            {t.name}
                        </button>
                    ))}
                </div>

                {/* 操作按钮 */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                    <button className="py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors text-sm shadow-md shadow-rose-200 dark:shadow-rose-900/30">
                        📷 保存图片
                    </button>
                    <button className="py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm">
                        📋 复制文字
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="mt-3 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    关闭
                </button>

                <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
                    💡 实施时可一键发布到小红书 / 微信，或保存到相册
                </div>
            </div>
        </div>
    );
}
