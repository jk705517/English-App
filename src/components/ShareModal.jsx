import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';

/* ==========================================================================
   听写分享卡 Modal（小红书"打卡日记"风）
   - 支持 4 种风格切换：暖桃 / 静谧蓝 / 牛奶白 / 抹茶绿
   - 努力 badge 文案根据 attemptCount 动态变化
   - 学到的词：从句子中自动提取最长的非常用词
   - 保存图片：html-to-image 把卡片渲染为 PNG，pixelRatio=2 保证高清
   ========================================================================== */

const CARD_THEMES = [
    { name: '暖桃', from: 'from-orange-100', via: 'via-rose-100', to: 'to-violet-100', accent: 'text-rose-500', border: 'border-rose-200' },
    { name: '静谧蓝', from: 'from-sky-50', via: 'via-blue-50', to: 'to-indigo-100', accent: 'text-indigo-500', border: 'border-indigo-200' },
    { name: '牛奶白', from: 'from-stone-50', via: 'via-amber-50', to: 'to-stone-100', accent: 'text-stone-600', border: 'border-stone-200' },
    { name: '抹茶绿', from: 'from-emerald-50', via: 'via-green-50', to: 'to-teal-100', accent: 'text-emerald-600', border: 'border-emerald-200' },
];

const COMMON_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'i', 'im', 'you', 'we', 'they', 'he', 'she', 'it', 'this', 'that', 'these', 'those',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'today', 'now',
    'me', 'my', 'your', 'have', 'has', 'do', 'does', 'be', 'been',
    'will', 'can', 'just', 'so', 'not', 'all', 'one', 'two', 'three',
    'making', 'make', 'let', 'lets', 'first', 'days',
]);

function tokenizeForExtract(text) {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"()]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function extractLearnedWord(text) {
    if (!text) return null;
    const words = tokenizeForExtract(text).filter(w => !COMMON_WORDS.has(w) && w.length >= 4);
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

/**
 * 简易"今日累计第 N 句"：每次打开分享卡时读 localStorage（按本机日期分桶）
 * 不在这里做自增——自增应该在父组件 markEngaged 时做
 */
function getTodayCountKey() {
    const d = new Date();
    return `bb_dict_today_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function getTodayCount() {
    try { return parseInt(localStorage.getItem(getTodayCountKey()) || '0', 10) || 0; }
    catch { return 0; }
}

const ShareModal = ({ sentence, videoTitle, attemptCount = 1, onClose }) => {
    const [themeIdx, setThemeIdx] = useState(0);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const cardRef = useRef(null);
    const theme = CARD_THEMES[themeIdx];
    const { date, time } = formatDate();
    const learnedWord = extractLearnedWord(sentence?.text || '');
    const todayCount = getTodayCount();

    // 努力 badge 文案——情绪核心
    const effortBadge = attemptCount <= 1
        ? { icon: '🎧', text: '一次就听到了 🎉', highlight: true }
        : attemptCount === 2
            ? { icon: '🎧', text: `听了 ${attemptCount} 遍才听到`, highlight: false }
            : { icon: '🎧', text: `听了 ${attemptCount} 遍才听到 ❤️`, highlight: false };

    const handleCopy = async () => {
        const lines = [
            `${date}  ${time}`,
            videoTitle ? `📺 ${videoTitle}` : null,
            '',
            `"${sentence?.text || ''}"`,
            sentence?.cn || '',
            '',
            `${effortBadge.icon} ${effortBadge.text}`,
            learnedWord ? `✨ 学到一个新词 "${learnedWord}"` : null,
            '',
            '💜 BiuBiu 学英语',
        ].filter(Boolean).join('\n');
        try {
            await navigator.clipboard.writeText(lines);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // 复制失败兜底：弹出文字让用户手动复制
            alert(lines);
        }
    };

    // 简单文件名：日期 + 句子前 20 字符，去掉非法字符
    const buildFileName = () => {
        const safeText = (sentence?.text || 'dictation')
            .slice(0, 20)
            .replace(/[\\/:*?"<>|]/g, '')
            .trim() || 'dictation';
        return `biubiu-${date.replace(/\./g, '-')}-${safeText}.png`;
    };

    const handleSaveImage = async () => {
        if (!cardRef.current || saving) return;
        setSaving(true);
        try {
            const dataUrl = await toPng(cardRef.current, {
                // pixelRatio: 3 → ~864×1152 输出（接近小红书 1080×1440 推荐尺寸）
                // 比 2x 大一倍文件（~60KB → ~120KB），但小红书全屏放大不再糊
                pixelRatio: 3,
                cacheBust: true,            // 防字体缓存导致的渲染异常
                backgroundColor: '#ffffff', // 兜底底色
            });

            // 触发浏览器下载
            // iOS Safari 对 download 属性支持有限，会改为在新标签打开图片 → 用户长按保存
            const link = document.createElement('a');
            link.download = buildFileName();
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('保存图片失败:', e);
            alert('保存失败，请截图或重试');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] bg-black/70 overflow-y-auto"
            onClick={onClose}
        >
            {/* min-h-screen + items-start：内容超过屏幕时能从顶部滚起；short content 时居中 */}
            <div className="min-h-screen flex items-start justify-center p-2 sm:p-4">
                <div
                    className="bg-white dark:bg-gray-900 rounded-3xl w-full p-3 sm:p-5 shadow-2xl my-2 sm:my-8"
                    style={{ maxWidth: '20rem' }}
                    onClick={(e) => e.stopPropagation()}
                >
                <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                    💌 分享我的听写日记
                </div>

                {/* 卡片预览（3:4 portrait，内部紧凑）—— ref 用于导出图片 */}
                <div
                    ref={cardRef}
                    className={`aspect-[3/4] bg-gradient-to-br ${theme.from} ${theme.via} ${theme.to} rounded-2xl p-4 shadow-inner border ${theme.border} flex flex-col`}
                >
                    {/* 顶部：日期 + 视频出处 */}
                    <div className="space-y-0.5">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 tracking-wide">
                            {date}  ·  {time}
                        </div>
                        {videoTitle && (
                            <div className="text-[10px] text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                <span>📺</span>
                                <span className="truncate">{videoTitle}</span>
                            </div>
                        )}
                    </div>

                    {/* 今日第 N 句（如果有累计）*/}
                    {todayCount > 0 && (
                        <div className={`mt-2 text-xs font-medium ${theme.accent}`}>
                            今天的第 {todayCount} 句 ✨
                        </div>
                    )}

                    {/* 主体：英文 + 中文 */}
                    <div className="flex-1 flex flex-col justify-center my-2 min-h-0">
                        <div
                            className="text-lg text-gray-800 dark:text-gray-100 leading-snug font-medium"
                            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
                        >
                            "{sentence?.text || ''}"
                        </div>
                        {sentence?.cn && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                                {sentence.cn}
                            </div>
                        )}
                    </div>

                    {/* 努力 + 收获 badge */}
                    <div className="space-y-1 text-xs">
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
                    <div className="mt-2 pt-2 border-t border-gray-300/40 dark:border-gray-600/40 flex items-center justify-center text-[10px]">
                        <div className="text-gray-500 dark:text-gray-400">
                            💜 BiuBiu 学英语
                        </div>
                    </div>
                </div>

                {/* 风格切换 */}
                <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
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
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                        onClick={handleSaveImage}
                        disabled={saving}
                        className="py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors text-sm shadow-md shadow-rose-200 dark:shadow-rose-900/30"
                    >
                        {saving ? '生成中…' : '📷 保存图片'}
                    </button>
                    <button
                        onClick={handleCopy}
                        className="py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm"
                    >
                        {copied ? '✓ 已复制' : '📋 复制文字'}
                    </button>
                </div>
                <button
                    onClick={onClose}
                    className="mt-2 w-full py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    关闭
                </button>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
