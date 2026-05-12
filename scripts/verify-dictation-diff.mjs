// 验证听写 diff 算法对每个测试场景输出是否符合预期
// 跑：node scripts/verify-dictation-diff.mjs

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

// 颜色标记，便于终端肉眼对比
const C = {
    correct: '\x1b[32m',   // 绿
    close:   '\x1b[33m',   // 黄
    wrong:   '\x1b[31m',   // 红
    missing: '\x1b[34m',   // 蓝
    extra:   '\x1b[90m',   // 灰
    reset:   '\x1b[0m',
    bold:    '\x1b[1m',
};

function format(diff) {
    return diff.map(item => {
        if (item.type === 'correct') return `${C.correct}${item.word}${C.reset}`;
        if (item.type === 'close')   return `${C.close}[${item.user}→${item.correct}]${C.reset}`;
        if (item.type === 'wrong')   return `${C.wrong}[${item.user}→${item.correct}]${C.reset}`;
        if (item.type === 'missing') return `${C.missing}[+${item.correct}]${C.reset}`;
        if (item.type === 'extra')   return `${C.extra}${item.user}̶${C.reset}`;
        return '';
    }).join(' ');
}

function summary(diff) {
    const counts = { correct: 0, close: 0, wrong: 0, missing: 0, extra: 0 };
    for (const item of diff) counts[item.type]++;
    return Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
}

const CORRECT = "Apple was not prepared for the AI revolution.";
const tests = [
    // ① 完全正确
    { label: '完全正确',                input: 'Apple was not prepared for the AI revolution.', expect: '5 correct... wait actually 8 correct,全部 ✓' },

    // ② 拼写接近
    { label: '② wan→was (close)',       input: 'Apple wan not prepared for the AI revolution',   expect: '1 close + 7 correct' },
    { label: '② prepered→prepared',     input: 'Apple was not prepered for the AI revolution',   expect: '1 close + 7 correct' },
    { label: '② revolutin→revolution',  input: 'Apple was not prepared for the AI revolutin',    expect: '1 close + 7 correct' },
    { label: '② revolutionn→revolution',input: 'Apple was not prepared for the AI revolutionn',  expect: '1 close + 7 correct' },

    // ③ 写错
    { label: '③ cat→was (wrong)',       input: 'Apple cat not prepared for the AI revolution',   expect: '1 wrong + 7 correct' },
    { label: '③ happy→not (wrong)',     input: 'Apple was happy prepared for the AI revolution', expect: '1 wrong + 7 correct' },
    { label: '③ ready→prepared (wrong)',input: 'Apple was not ready for the AI revolution',      expect: '1 wrong + 7 correct' },

    // ④ 多写
    { label: '④ +really',               input: 'Apple was really not prepared for the AI revolution',     expect: '1 extra + 8 correct' },
    { label: '④ +and+more',             input: 'Apple was not prepared for the AI revolution and more',   expect: '2 extra + 8 correct' },
    { label: '④ +An at start',          input: 'An Apple was not prepared for the AI revolution',         expect: '1 extra + 8 correct' },

    // ⑤ 漏写
    { label: '⑤ -was',                  input: 'Apple not prepared for the AI revolution',         expect: '1 missing + 7 correct' },
    { label: '⑤ -not',                  input: 'Apple was prepared for the AI revolution',         expect: '1 missing + 7 correct' },
    { label: '⑤ -prepared,-for',        input: 'Apple was not the AI revolution',                  expect: '2 missing + 6 correct' },
    { label: '⑤ 只剩 2 个词',           input: 'Apple revolution',                                  expect: '6 missing + 2 correct' },

    // ⑥ 混合
    { label: '⑥ close + wrong + close',  input: 'Apple wan happy prepared for the AI revoluion',   expect: 'close + wrong + close + correct' },
    { label: '⑥ extra + missing + close',input: 'Apple was really not for the AI revolutionn',     expect: 'extra + missing + close + correct' },
    { label: '⑥ +An + no→not (wrong)',   input: 'An Apple was no prepared for the AI revolution',  expect: 'extra + wrong (no太短) + correct' },

    // ⑦ 边界
    { label: '⑦ 标点',                  input: 'Apple, was not prepared for the AI revolution!',   expect: '全 correct' },
    { label: '⑦ 大写',                  input: 'APPLE WAS NOT PREPARED FOR THE AI REVOLUTION',     expect: '全 correct' },
    { label: '⑦ 小写',                  input: 'apple was not prepared for the ai revolution',     expect: '全 correct' },
    { label: '⑦ 缩写 wasn\'t',          input: "Apple wasn't prepared for the AI revolution",      expect: '已知坑: wasn t 被拆开' },
];

console.log(`\n${C.bold}原文：${C.reset}${CORRECT}\n`);
console.log('─'.repeat(80));

for (const t of tests) {
    const diff = compareSentences(t.input, CORRECT);
    console.log(`\n${C.bold}${t.label}${C.reset}`);
    console.log(`  输入: ${t.input}`);
    console.log(`  对照: ${format(diff)}`);
    console.log(`  统计: ${summary(diff)}`);
    console.log(`  预期: ${t.expect}`);
}
console.log();
