# PowerShell script to modify VideoDetail.jsx for Supabase migration

$filePath = "src/pages/VideoDetail.jsx"
$content = Get-Content $filePath -Raw

# 1. Replace import statement
$content = $content -replace "import \{ mockVideos \} from '../data/mockData';", "import { supabase } from '../lib/supabase';"

# 2. Add allVideos state after videoData state
$content = $content -replace "(\[videoData, setVideoData\] = useState\(null\);)", "`$1`r`n    const [allVideos, setAllVideos] = useState([]);"

# 3. Replace the data fetching useEffect
$oldFetch = @"
    // 初始化数据
    useEffect\(\(\) => \{
        const video = mockVideos\.find\(v => v\.id === parseInt\(id\)\);
        if \(video\) \{
            setVideoData\(video\);
        \}

        // 每次切换视频时，重新检查该视频的学习状态和收藏状态
        const learnedIds = JSON\.parse\(localStorage\.getItem\('learnedVideoIds'\) \|\| '\[\]'\);
        setIsLearned\(learnedIds\.includes\(parseInt\(id\)\)\);

        const favoriteIds = JSON\.parse\(localStorage\.getItem\('favoriteVideoIds'\) \|\| '\[\]'\);
        setIsFavorite\(favoriteIds\.includes\(parseInt\(id\)\)\);
    \}, \[id\]\);
"@

$newFetch = @"
    // 从 Supabase 获取当前视频数据
    useEffect(() => {
        const fetchVideoData = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('id', parseInt(id))
                .single();
            
            if (error) {
                console.error('Error fetching video:', error);
            } else {
                setVideoData(data);
            }
        };

        fetchVideoData();

        // 每次切换视频时，重新检查该视频的学习状态和收藏状态
        const learnedIds = JSON.parse(localStorage.getItem('learnedVideoIds') || '[]');
        setIsLearned(learnedIds.includes(parseInt(id)));

        const favoriteIds = JSON.parse(localStorage.getItem('favoriteVideoIds') || '[]');
        setIsFavorite(favoriteIds.includes(parseInt(id)));
    }, [id]);

    // 获取所有视频用于上一期/下一期导航
    useEffect(() => {
        const fetchAllVideos = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('id, episode')
                .order('episode', { ascending: false });
            
            if (error) {
                console.error('Error fetching all videos:', error);
            } else {
                setAllVideos(data || []);
            }
        };

        fetchAllVideos();
    }, []);
"@

$content = $content -replace $oldFetch, $newFetch

# 4. Replace mockVideos with allVideos in navigation
$content = $content -replace "mockVideos\.findIndex", "allVideos.findIndex"
$content = $content -replace "mockVideos\[mockVideos\.findIndex", "allVideos[allVideos.findIndex"
$content = $content -replace "mockVideos\.length", "allVideos.length"

# 5. Replace videoUrl with video_url
$content = $content -replace "url=\{videoData\.videoUrl\}", "url={videoData.video_url}"

# Save the modified content
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "VideoDetail.jsx has been successfully modified for Supabase integration"
