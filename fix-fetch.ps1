# Fix the useEffect data fetching section
$filePath = "src/pages/VideoDetail.jsx"
$content = Get-Content $filePath -Raw

# Find and replace the entire useEffect block for data initialization
$pattern = @"
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

$replacement = @"
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

$content = $content -replace $pattern, $replacement

# Also fix any remaining mockVideos references in navigation
$content = $content -replace "mockVideos\[allVideos", "allVideos[allVideos"

Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "Fixed data fetching logic"
