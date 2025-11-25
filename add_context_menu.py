import sys

# Read the file
with open('src/pages/VideoDetail.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the specific line
old_line = '                <div className="w-full aspect-video md:flex-1 bg-black rounded-lg md:rounded-xl overflow-hidden shadow-lg">'
new_line = '                <div className="w-full aspect-video md:flex-1 bg-black rounded-lg md:rounded-xl overflow-hidden shadow-lg" onContextMenu={(e) => e.preventDefault()}>'

if old_line in content:
    content = content.replace(old_line, new_line)
    with open('src/pages/VideoDetail.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Added onContextMenu handler")
else:
    print("ERROR: Could not find the target line")
    sys.exit(1)
