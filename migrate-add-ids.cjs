/**
 * Migration Script: Add stable IDs to transcript and vocab JSON arrays
 * 
 * This script:
 * 1. Fetches all videos from Supabase
 * 2. For each video, adds unique 'id' field to each transcript/vocab item
 * 3. Updates the video record in Supabase
 * 
 * ID format: 
 * - transcript: starts from 1, increments per item
 * - vocab: starts from 1, increments per item
 * 
 * Run: node migrate-add-ids.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Read from .env or environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateVideoIds() {
    console.log('🚀 Starting migration: Adding IDs to transcript and vocab...\n');

    // 1. Fetch all videos
    const { data: videos, error: fetchError } = await supabase
        .from('videos')
        .select('id, title, transcript, vocab');

    if (fetchError) {
        console.error('❌ Error fetching videos:', fetchError);
        process.exit(1);
    }

    console.log(`📦 Found ${videos.length} videos to process\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const video of videos) {
        let needsUpdate = false;
        let transcriptWithIds = video.transcript;
        let vocabWithIds = video.vocab;

        // Process transcript
        if (Array.isArray(video.transcript) && video.transcript.length > 0) {
            // Check if first item already has id
            if (!video.transcript[0].hasOwnProperty('id')) {
                transcriptWithIds = video.transcript.map((item, index) => ({
                    id: index + 1, // 1-based ID
                    ...item
                }));
                needsUpdate = true;
                console.log(`  ✅ Video ${video.id}: Added IDs to ${transcriptWithIds.length} transcript items`);
            } else {
                console.log(`  ⏭️  Video ${video.id}: transcript already has IDs`);
            }
        }

        // Process vocab
        if (Array.isArray(video.vocab) && video.vocab.length > 0) {
            // Check if first item already has id
            if (!video.vocab[0].hasOwnProperty('id')) {
                vocabWithIds = video.vocab.map((item, index) => ({
                    id: index + 1, // 1-based ID
                    ...item
                }));
                needsUpdate = true;
                console.log(`  ✅ Video ${video.id}: Added IDs to ${vocabWithIds.length} vocab items`);
            } else {
                console.log(`  ⏭️  Video ${video.id}: vocab already has IDs`);
            }
        }

        // Update if needed
        if (needsUpdate) {
            const { error: updateError } = await supabase
                .from('videos')
                .update({
                    transcript: transcriptWithIds,
                    vocab: vocabWithIds
                })
                .eq('id', video.id);

            if (updateError) {
                console.error(`  ❌ Error updating video ${video.id}:`, updateError);
            } else {
                updatedCount++;
            }
        } else {
            skippedCount++;
        }
    }

    console.log('\n✨ Migration complete!');
    console.log(`   Updated: ${updatedCount} videos`);
    console.log(`   Skipped: ${skippedCount} videos (already had IDs)`);
}

migrateVideoIds().catch(console.error);
