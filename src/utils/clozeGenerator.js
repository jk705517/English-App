/**
 * 生成挖空数据
 * @param {Array} transcript - 字幕数组 [{text: "...", ...}]
 * @param {Array} vocabList - 词汇表 [{word: "...", ...}]
 * @param {number} maxClozesPerVideo - 全视频最大挖空数 (软上限)
 * @returns {Object} map of lineIndex -> array of segments
 */
export const generateClozeData = (transcript, vocabList, maxClozesPerVideo = 50) => {
    if (!transcript || !vocabList || vocabList.length === 0) return {};

    // 1. 预处理词汇表：按长度降序排列 (Longest Match First)
    const sortedVocab = [...vocabList].sort((a, b) => b.word.length - a.word.length);

    const allCandidates = []; // { lineIndex, matchIndex, text, vocabInfo, length }

    // 2. 遍历每一行，寻找所有可能的匹配
    transcript.forEach((line, lineIndex) => {
        const text = line.text;
        const lowerText = text.toLowerCase();

        // 记录该行已被占用的区间，防止重叠
        // interval: [start, end)
        const occupied = [];

        // 尝试匹配每个词汇
        sortedVocab.forEach(vocab => {
            const vocabWord = vocab.word;
            const lowerVocab = vocabWord.toLowerCase();

            // 使用正则进行全词匹配
            // 注意：需要转义正则特殊字符
            const escapedVocab = lowerVocab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedVocab}\\b`, 'gi');

            let match;
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const end = start + match[0].length;

                // 检查是否与已有匹配重叠
                const isOverlapping = occupied.some(interval =>
                    (start < interval.end && end > interval.start)
                );

                if (!isOverlapping) {
                    occupied.push({ start, end });
                    allCandidates.push({
                        lineIndex,
                        start,
                        end,
                        text: match[0], // 原文中的写法（保留大小写）
                        vocabInfo: vocab,
                        length: match[0].length
                    });
                }
            }
        });
    });

    // 3. 全局筛选
    // 策略：
    // a. 每行最多 2 个
    // b. 总数控制在 maxClozesPerVideo 以内
    // c. 优先保留长词

    // 先按长度降序排列所有候选
    allCandidates.sort((a, b) => b.length - a.length);

    const finalClozes = [];
    const lineCounts = {}; // 记录每行已选数量
    let totalCount = 0;

    for (const candidate of allCandidates) {
        if (totalCount >= maxClozesPerVideo) break;

        const currentLineCount = lineCounts[candidate.lineIndex] || 0;
        if (currentLineCount >= 2) continue;

        finalClozes.push(candidate);
        lineCounts[candidate.lineIndex] = currentLineCount + 1;
        totalCount++;
    }

    // 4. 格式化输出：将每行转换为 segments 数组
    // segments: Array<{ type: 'text' | 'cloze', content: string, vocabInfo?: object }>
    const result = {};

    // 按行分组
    const clozesByLine = {};
    finalClozes.forEach(c => {
        if (!clozesByLine[c.lineIndex]) clozesByLine[c.lineIndex] = [];
        clozesByLine[c.lineIndex].push(c);
    });

    transcript.forEach((line, lineIndex) => {
        const clozes = clozesByLine[lineIndex];
        if (!clozes || clozes.length === 0) {
            // 没有挖空，整行文本
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
                content: cloze.text, // 答案
                vocabInfo: cloze.vocabInfo
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
