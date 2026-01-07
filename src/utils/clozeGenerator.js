/**
 * 生成挖空数据
 * @param {Array} transcript - 字幕数组 [{text: "...", ...}]
 * @param {Array} vocabList - 词汇表 [{word: "...", ...}]
 * @returns {Object} map of lineIndex -> array of segments
 */
export const generateClozeData = (transcript, vocabList) => {
    if (!transcript || !vocabList || vocabList.length === 0) return {};

    // 1. 预处理词汇表：按长度降序排列 (Longest Match First)
    // 这样可以优先匹配长短语，避免短词（如 time）抢占长词（如 timeless）的一部分
    const sortedVocab = [...vocabList].sort((a, b) => b.word.length - a.word.length);

    // 记录已处理的 vocab word (normalized)，确保每个 vocab 只挖一次
    const processedVocab = new Set();

    // 记录每行已被占用的区间，防止重叠
    // map: lineIndex -> Array<{start, end}>
    const lineOccupied = {};

    const allCandidates = []; // { lineIndex, start, end, text, vocabInfo }

    // 2. 遍历每一行，寻找匹配
    // 我们需要对每个 vocab word 在整个 transcript 中找第一次出现的位置
    // 为了效率，我们可以遍历 transcript 一次，但在每行里尝试匹配所有还未找到的 vocab
    // 或者遍历 vocab，对每个 vocab 在 transcript 中找第一次出现
    // 鉴于 vocab 数量通常不多 (几十个)，遍历 vocab 可能更符合"每个 vocab 只挖一次"的逻辑

    // 为了实现 Longest Match First 且不重叠，我们需要小心。
    // 如果我们按 vocab 顺序遍历，长词先匹配。一旦匹配到第一次出现，就占位。
    // 后续短词如果出现在同一位置，就跳过。

    sortedVocab.forEach(vocab => {
        const vocabWord = vocab.word;
        const lowerVocab = vocabWord.toLowerCase();

        // 如果这个词已经挖过了，跳过 (虽然 vocabList 应该不含重复 word，但防守一下)
        if (processedVocab.has(lowerVocab)) return;

        // 转义正则特殊字符
        const escapedVocab = lowerVocab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 全词匹配正则
        const regex = new RegExp(`\\b${escapedVocab}\\b`, 'gi');

        // 找到该词汇在原始 vocabList 中的索引（用于生成与 HighlightedText 一致的 vocabId）
        const vocabIndex = vocabList.findIndex(v => v.word.toLowerCase() === lowerVocab);

        // 在 transcript 中寻找第一次出现
        for (let i = 0; i < transcript.length; i++) {
            const line = transcript[i];
            const text = line.text;

            // 重置正则 lastIndex
            regex.lastIndex = 0;

            const match = regex.exec(text);
            if (match) {
                const start = match.index;
                const end = start + match[0].length;

                // 检查是否与该行已有匹配重叠
                const occupied = lineOccupied[i] || [];
                const isOverlapping = occupied.some(interval =>
                    (start < interval.end && end > interval.start)
                );

                if (!isOverlapping) {
                    // 找到了！记录下来
                    allCandidates.push({
                        lineIndex: i,
                        start,
                        end,
                        text: match[0], // 保留原文大小写
                        vocabInfo: vocab,
                        vocabIndex  // 新增：保存词汇在 vocabList 中的原始索引
                    });

                    // 标记该行此区间被占用
                    if (!lineOccupied[i]) lineOccupied[i] = [];
                    lineOccupied[i].push({ start, end });

                    // 标记该 vocab 已处理
                    processedVocab.add(lowerVocab);

                    // 找到第一次出现后，立即停止对该 vocab 的搜索
                    break;
                }
            }
        }
    });

    // 3. 格式化输出
    const result = {};

    // 按行分组
    const clozesByLine = {};
    allCandidates.forEach(c => {
        if (!clozesByLine[c.lineIndex]) clozesByLine[c.lineIndex] = [];
        clozesByLine[c.lineIndex].push(c);
    });

    transcript.forEach((line, lineIndex) => {
        const clozes = clozesByLine[lineIndex];
        if (!clozes || clozes.length === 0) {
            result[lineIndex] = [{ type: 'text', content: line.text }];
            return;
        }

        // 按位置排序
        clozes.sort((a, b) => a.start - b.start);

        const segments = [];
        let currentIndex = 0;

        clozes.forEach(cloze => {
            // 添加挖空前的文本
            if (cloze.start > currentIndex) {
                segments.push({
                    type: 'text',
                    content: line.text.substring(currentIndex, cloze.start)
                });
            }

            // 添加挖空项
            segments.push({
                type: 'cloze',
                content: cloze.text,
                vocabInfo: cloze.vocabInfo,
                vocabIndex: cloze.vocabIndex  // 新增：传递词汇索引
            });

            currentIndex = cloze.end;
        });

        // 添加剩余文本
        if (currentIndex < line.text.length) {
            segments.push({
                type: 'text',
                content: line.text.substring(currentIndex)
            });
        }

        result[lineIndex] = segments;
    });

    return result;
};
