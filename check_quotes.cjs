const fs = require('fs');
const content = fs.readFileSync('src/pages/VideoDetail.jsx', 'utf8');
const lines = content.split('\n');

let inSingle = false;
let inDouble = false;
let inBacktick = false;
let backtickStartLine = -1;

let braceCount = 0;
let parenCount = 0;
let prevBraceCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];

        // Handle quotes
        if (char === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
        else if (char === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
        else if (char === '`' && !inSingle && !inDouble) {
            inBacktick = !inBacktick;
            if (inBacktick) backtickStartLine = i + 1;
        }

        // Handle braces/parens only if not in string
        if (!inSingle && !inDouble && !inBacktick) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            else if (char === '(') parenCount++;
            else if (char === ')') parenCount--;
        }
    }

    if (inSingle || inDouble) {
        console.log(`Error at Line ${i + 1}: Single=${inSingle}, Double=${inDouble} (EOL)`);
        console.log(line);
        process.exit(1);
    }

    if (braceCount < 0) {
        console.log(`Error at Line ${i + 1}: Negative brace count (extra closing brace)`);
        process.exit(1);
    }
    if (parenCount < 0) {
        console.log(`Error at Line ${i + 1}: Negative paren count (extra closing paren)`);
        process.exit(1);
    }

    // Log brace count for debugging - only when it changes
    if (braceCount !== prevBraceCount) {
        console.log(`Line ${i + 1}: Brace=${braceCount} (was ${prevBraceCount})`);
        prevBraceCount = braceCount;
    }
}

if (inBacktick) {
    console.log(`Error at EOF: Unclosed backtick starting at Line ${backtickStartLine}`);
    process.exit(1);
}

if (braceCount !== 0) {
    console.log(`Error at EOF: Unbalanced braces. Count: ${braceCount}`);
    process.exit(1);
}
if (parenCount !== 0) {
    console.log(`Error at EOF: Unbalanced parens. Count: ${parenCount}`);
    process.exit(1);
}
console.log('Syntax check passed!');
