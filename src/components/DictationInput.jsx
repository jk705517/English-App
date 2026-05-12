import { useState, useRef, useEffect } from 'react';
import ShareModal from './ShareModal';

/* ==========================================================================
   听写输入组件 v3（回到原版"直接对照"逻辑 + v8 设计的紧凑布局/分享卡）

   核心交互：
   - 输入 → 提交 → 答错：直接显示完整词级对照（pill 样式，user → correct）
   - 输入框保持可编辑 → 用户对照答案修改 → 再交，直到答对
   - 答对：庆祝卡 + 分享 / 跟读 / 下一句 三选

   与原版（commit ca0324a）的关系：
   - 算法、diff 类型、pill 视觉语言：完全一致
   - 改进点：紧凑布局 / ✕ 一键清空 / 庆祝状态 / 💌 分享卡 / 切跟读 off-ramp
   ========================================================================== */

// ---------- 词级 diff（Needleman-Wunsch 词级对齐 + 编辑距离容错）----------
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

// ---------- 子组件 ----------
function Chip({ icon, label, active, muted, onClick }) {
    const base = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border-2 active:scale-95';
    let style;
    if (active) {
        style = 'bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300';
    } else if (muted) {
        style = 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700';
    } else {
        style = 'bg-white border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-violet-900/20';
    }
    return (
        <button type="button" onClick={onClick} className={`${base} ${style}`}>
            <span>{icon}</span>
            <span>{label}</span>
        </button>
    );
}

// 词级对照 pill：直接展示用户写的 → 正确的对应词
// onWordLookup 提供时，close/wrong/missing 的"原文词"变成可点击（弹查词卡 → 可加入生词本）
function PillDiff({ diff, onWordLookup }) {
    // 渲染可点击的"原文词"（带书本图标暗示可查词）
    const renderLookupWord = (word, colorClass) => {
        if (!onWordLookup) {
            return <span className={colorClass}>{word}</span>;
        }
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onWordLookup(word); }}
                className={`${colorClass} inline-flex items-center gap-0.5 hover:underline underline-offset-2 decoration-dotted cursor-pointer transition-colors`}
                title={`点击查 "${word}" 的释义并加入生词本`}
            >
                {word}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            </button>
        );
    };

    return (
        <div className="flex flex-wrap gap-x-1.5 gap-y-1.5 text-base leading-relaxed">
            {diff.map((item, i) => {
                if (item.type === 'correct') {
                    return (
                        <span key={i} className="text-green-600 dark:text-green-400 font-medium">
                            {item.word}
                        </span>
                    );
                }
                if (item.type === 'close') {
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800"
                        >
                            <span className="text-xs text-yellow-700 dark:text-yellow-400 line-through opacity-70">{item.user}</span>
                            <span className="text-xs text-yellow-700 dark:text-yellow-400">→</span>
                            {renderLookupWord(item.correct, 'text-yellow-800 dark:text-yellow-300 font-semibold')}
                        </span>
                    );
                }
                if (item.type === 'wrong') {
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800"
                        >
                            <span className="text-xs text-rose-600 dark:text-rose-400 line-through opacity-70">{item.user}</span>
                            <span className="text-xs text-rose-600 dark:text-rose-400">→</span>
                            {renderLookupWord(item.correct, 'text-green-700 dark:text-green-400 font-bold')}
                        </span>
                    );
                }
                if (item.type === 'missing') {
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                        >
                            <span className="text-blue-700 dark:text-blue-400 font-bold">+</span>
                            {renderLookupWord(item.correct, 'text-blue-800 dark:text-blue-300 font-semibold')}
                        </span>
                    );
                }
                if (item.type === 'extra') {
                    return (
                        <span
                            key={i}
                            className="text-gray-400 dark:text-gray-500 line-through decoration-2 opacity-70"
                            title="原文里没有这个词"
                        >
                            {item.user}
                        </span>
                    );
                }
                return null;
            })}
        </div>
    );
}

/**
 * 听写输入组件（v3 = 原版"直接对照"风格 + v8 紧凑布局/庆祝/分享）
 *
 * @prop {string} correctAnswer  标准答案
 * @prop {string} cnText         中文翻译（用于「看中文」chip 和庆祝卡）
 * @prop {number} currentIndex   当前句索引
 * @prop {number} totalCount     总句数
 * @prop {string} videoTitle     视频标题（分享卡用）
 * @prop {boolean} hasPlayed     当前句是否已播过
 * @prop {Function} onCorrect    ({ firstTry, attemptCount }) => void
 * @prop {Function} onSkip       () => void  跳过
 * @prop {Function} onAttempt    () => void  首次提交时触发（用于父组件 mark engaged）
 * @prop {Function} onReplay     () => void  重听
 * @prop {Function} onSwitchToShadow  () => void  off-ramp
 * @prop {Function} onNext       () => void  下一句
 * @prop {Function} onWordLookup (word) => void  点击 pill 里的原文词 → 弹查词卡（可加生词本）
 */
const DictationInput = ({
    correctAnswer,
    cnText = '',
    currentIndex,
    totalCount,
    videoTitle = '',
    hasPlayed = false,
    onCorrect,
    onSkip,
    onAttempt,
    onReplay,
    onSwitchToShadow,
    onNext,
    onWordLookup,
}) => {
    const [userInput, setUserInput] = useState('');
    const [status, setStatus] = useState('writing'); // writing | correct
    const [diff, setDiff] = useState(null);
    const [attemptCount, setAttemptCount] = useState(0);
    const [hintShown, setHintShown] = useState(false);
    const [cnShown, setCnShown] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const hasBeenWrongRef = useRef(false);
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleSubmit = () => {
        if (!userInput.trim()) return;
        const result = compareSentences(userInput, correctAnswer);
        // pass 严格判定：必须每个词都完全正确（correct）
        // close（差 1 字母）/ wrong / missing / extra 任一存在都不算 pass
        // → 留在 writing 状态看 diff，让用户修正拼写后再交
        // 这是学习产品的关键 —— 不能"宽容地"原谅拼写错误，否则用户永远看不到错在哪
        const passed = result.length > 0 && result.every(r => r.type === 'correct');
        const nextAttempt = attemptCount + 1;
        setDiff(result);
        setAttemptCount(nextAttempt);
        // 首次提交时通知父组件 mark engaged
        if (attemptCount === 0) onAttempt?.();
        if (passed) {
            setStatus('correct');
            onCorrect?.({ firstTry: !hasBeenWrongRef.current, attemptCount: nextAttempt });
        } else {
            hasBeenWrongRef.current = true;
            // 留在 writing：textarea 仍可编辑，diff 显示在下方，用户对照修改后再交
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && status === 'writing') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            onSkip?.();
        }
    };

    const handleSkip = () => onSkip?.();

    const hintText = correctAnswer.split(' ')
        .map(w => w.replace(/[^a-zA-Z]/g, '')[0] || '')
        .join(' ');

    return (
        <div className="space-y-3">

            {/* ============ writing 状态：输入 + 对照 + 可继续修改 ============ */}
            {status === 'writing' && (
                <>
                    {/* 位置 + 听音按钮 */}
                    <div className="text-center space-y-1.5">
                        <div className="text-xs text-gray-400 dark:text-gray-500 tracking-wider">
                            {currentIndex + 1} / {totalCount}
                            {attemptCount > 0 && (
                                <span className="ml-2 text-amber-500">· 第 {attemptCount + 1} 次尝试</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onReplay}
                            aria-label={hasPlayed ? '再听一遍' : '听一遍'}
                            className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 to-violet-500 shadow-lg shadow-violet-200 dark:shadow-violet-900/30 hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all"
                        >
                            <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.84A1 1 0 004.5 3.66v12.68a1 1 0 001.8.82l9.6-6.34a1 1 0 000-1.64l-9.6-6.34z" />
                            </svg>
                        </button>
                    </div>

                    {/* 输入框（始终可编辑，右上角 ✕ 一键清空）*/}
                    <div className="relative">
                        <textarea
                            ref={inputRef}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="💭 你听到了什么？"
                            rows={2}
                            className={`w-full p-3.5 pr-10 text-base md:text-lg border-2 rounded-2xl resize-none bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 focus:outline-none focus:ring-4 transition-all
                                ${attemptCount > 0
                                    ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-100 dark:border-amber-700 dark:focus:ring-amber-900/30'
                                    : 'border-gray-200 dark:border-gray-700 focus:border-violet-300 focus:ring-violet-100 dark:focus:ring-violet-900/30'
                                }
                            `}
                        />
                        {userInput && (
                            <button
                                type="button"
                                onClick={() => { setUserInput(''); inputRef.current?.focus(); }}
                                aria-label="清空输入"
                                title="清空"
                                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* 词级对照 pills（首次提交后显示）*/}
                    {diff && diff.length > 0 && (
                        <>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-3">
                                <div className="text-xs text-amber-700 dark:text-amber-400 mb-2 flex items-center justify-between gap-1.5">
                                    <span>🎤 原文对照</span>
                                    {onWordLookup && (
                                        <span className="text-[10px] text-amber-600 dark:text-amber-500/80">
                                            点带 📖 的词可查释义并加入生词本
                                        </span>
                                    )}
                                </div>
                                <PillDiff diff={diff} onWordLookup={onWordLookup} />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                                💡 看上面的对照，可以继续修改你的答案再提交
                            </div>
                        </>
                    )}

                    {/* Chip 工具栏 */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        <Chip
                            icon="🔠"
                            label={hintShown ? '隐藏首字母' : '看首字母'}
                            active={hintShown}
                            onClick={() => setHintShown(v => !v)}
                        />
                        {cnText && (
                            <Chip
                                icon="📖"
                                label={cnShown ? '隐藏中文' : '看中文'}
                                active={cnShown}
                                onClick={() => setCnShown(v => !v)}
                            />
                        )}
                        <Chip
                            icon="⏭"
                            label="跳过"
                            onClick={handleSkip}
                            muted
                        />
                    </div>

                    {/* 首字母 / 中文展开区 */}
                    {hintShown && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-center">
                            <div className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">首字母</div>
                            <div className="font-mono text-base tracking-wider text-yellow-900 dark:text-yellow-200">{hintText}</div>
                        </div>
                    )}
                    {cnShown && cnText && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                            <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">中文意思</div>
                            <div className="text-sm text-blue-900 dark:text-blue-200">{cnText}</div>
                        </div>
                    )}

                    {/* 主按钮 */}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!userInput.trim()}
                        className="w-full py-3 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 text-white text-base font-medium rounded-2xl shadow-md shadow-violet-200 dark:shadow-violet-900/20 transition-all"
                    >
                        ⏎ {attemptCount === 0 ? '提交' : '再交一次'}
                    </button>

                    {/* 键盘提示 */}
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500">
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd> 提交
                        <span className="mx-1">·</span>
                        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> 跳过
                    </div>

                    {/* 跟读 off-ramp（首次错后显示）*/}
                    {attemptCount > 0 && onSwitchToShadow && (
                        <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl px-3 py-2 text-center text-xs">
                            <span className="text-gray-500 dark:text-gray-400">这句有点难？</span>
                            <button
                                type="button"
                                onClick={onSwitchToShadow}
                                className="ml-2 text-violet-600 dark:text-violet-400 hover:underline"
                            >
                                🎤 切到跟读 →
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ============ correct 状态 ============ */}
            {status === 'correct' && (
                <>
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 tracking-wider">
                        {currentIndex + 1} / {totalCount} ✓
                    </div>

                    <div className="text-center space-y-2 py-2">
                        <div className="text-4xl">✨</div>
                        <div className="text-lg font-medium text-gray-800 dark:text-gray-200">
                            {attemptCount === 1 ? '你听到了！' : `第 ${attemptCount} 次，你听到了`}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-violet-50 to-emerald-50/50 dark:from-violet-900/20 dark:to-emerald-900/10 rounded-2xl p-5 border border-violet-200 dark:border-violet-800 text-center">
                        <div className="text-lg text-gray-800 dark:text-gray-100 font-medium leading-relaxed">
                            {correctAnswer}
                        </div>
                        {cnText && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                {cnText}
                            </div>
                        )}
                    </div>

                    {/* 三选操作 */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowShareModal(true)}
                            className="flex-1 py-2.5 bg-white dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-medium rounded-xl transition-colors text-sm"
                        >
                            💌 分享
                        </button>
                        {onSwitchToShadow && (
                            <button
                                type="button"
                                onClick={onSwitchToShadow}
                                className="flex-1 py-2.5 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-medium rounded-xl transition-colors text-sm"
                            >
                                🎤 跟读
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onNext}
                            className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-xl shadow-md shadow-violet-200 dark:shadow-violet-900/20 transition-colors text-sm"
                        >
                            下一句 →
                        </button>
                    </div>
                </>
            )}

            {/* 分享 Modal */}
            {showShareModal && (
                <ShareModal
                    sentence={{ text: correctAnswer, cn: cnText }}
                    videoTitle={videoTitle}
                    attemptCount={attemptCount || 1}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
};

export default DictationInput;
