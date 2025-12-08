-- ============================================================
-- 迁移脚本：为 videos 表的 transcript 和 vocab JSON 数组添加 id 字段
-- ============================================================
-- 说明：
--   1. 为 transcript 数组的每个元素添加 id（从 1 递增，幂等）
--   2. 为 vocab 数组的每个元素添加 id（从 1 递增，幂等）
--   3. 清理 user_favorites 中无效的 NULL item_id 记录
-- ============================================================


-- ============================================================
-- 第一部分：为 transcript 数组的每个元素添加 id
-- ============================================================

UPDATE videos
SET transcript = (
    SELECT jsonb_agg(
        CASE 
            -- 如果元素已有 id，保持不变
            WHEN elem ? 'id' THEN elem
            -- 否则添加 id（基于数组下标 + 1）
            ELSE jsonb_build_object('id', idx + 1) || elem
        END
        ORDER BY idx
    )
    FROM jsonb_array_elements(transcript::jsonb) WITH ORDINALITY AS t(elem, idx)
)
WHERE transcript IS NOT NULL 
  AND jsonb_array_length(transcript::jsonb) > 0;


-- ============================================================
-- 第二部分：为 vocab 数组的每个元素添加 id
-- ============================================================

UPDATE videos
SET vocab = (
    SELECT jsonb_agg(
        CASE 
            -- 如果元素已有 id，保持不变
            WHEN elem ? 'id' THEN elem
            -- 否则添加 id（基于数组下标 + 1）
            ELSE jsonb_build_object('id', idx + 1) || elem
        END
        ORDER BY idx
    )
    FROM jsonb_array_elements(vocab::jsonb) WITH ORDINALITY AS t(elem, idx)
)
WHERE vocab IS NOT NULL 
  AND jsonb_array_length(vocab::jsonb) > 0;


-- ============================================================
-- 第三部分：清理无效的收藏记录（item_id 为 NULL 的 sentence/vocab）
-- ============================================================

DELETE FROM user_favorites
WHERE item_type IN ('sentence', 'vocab')
  AND item_id IS NULL;


-- ============================================================
-- 验证：检查迁移结果
-- ============================================================

-- 查看每个视频的 transcript 第一条是否有 id
SELECT 
    id AS video_id,
    title,
    (transcript::jsonb->0->>'id') AS first_transcript_id,
    (vocab::jsonb->0->>'id') AS first_vocab_id
FROM videos
ORDER BY id;
