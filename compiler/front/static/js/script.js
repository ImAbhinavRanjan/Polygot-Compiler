let editor;
let currentLanguage = 'undetected';
let detectTimer = null;
let isDarkTheme = true;

// Add this at the top of the file
const API_BASE_URL = 'http://127.0.0.1:8000/front';

document.addEventListener('DOMContentLoaded', () => {
    // Set initial theme
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    
    // Initialize CodeMirror
    editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
        lineNumbers: true,
        theme: isDarkTheme ? 'dracula' : 'default',
        mode: 'text/plain',
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        lineWrapping: true,
        tabSize: 4,
        viewportMargin: Infinity,
        autofocus: true,
        fixedGutter: true,
        gutters: ["CodeMirror-linenumbers"],
        extraKeys: {
            "Tab": "indentMore",
            "Shift-Tab": "indentLess"
        }
    });

    // Force a refresh after initialization
    editor.refresh();

    // Initialize Split.js
    if (window.innerWidth > 768) {
        Split(['#split-container .editor-section', '#split-container .result-section'], {
            sizes: [60, 40],
            minSize: [300, 300],
            gutterSize: 10,
            snapOffset: 0,
            onDragEnd: function() {
                editor.refresh();
            }
        });
    }

    // Setup theme toggle with immediate effect
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', toggleTheme);
    // Set initial icon
    themeToggle.querySelector('i').className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';

    // Setup event listeners
    editor.on('change', handleEditorChange);
    document.getElementById('run-btn').addEventListener('click', handleRunCode);
    document.getElementById('analyze-complexity-btn').addEventListener('click', handleAnalyzeComplexity);
    // Removed AI Debug and Optimize Code event listeners
    document.getElementById('clear-editor-btn').addEventListener('click', clearEditor);
    document.getElementById('copy-output-btn').addEventListener('click', copyOutput);
    document.getElementById('increase-font-btn').addEventListener('click', () => adjustFontSize(1));
    document.getElementById('decrease-font-btn').addEventListener('click', () => adjustFontSize(-1));
});

// Add this function to handle window load
window.addEventListener('load', () => {
    setTimeout(() => {
        editor.refresh();
    }, 100);
});

// Add window resize handler
window.addEventListener('resize', () => {
    editor.refresh();
});

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    
    // Update document theme
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    
    // Update CodeMirror theme
    editor.setOption('theme', isDarkTheme ? 'dracula' : 'default');
    
    // Update button icon
    const themeIcon = document.querySelector('#theme-toggle i');
    themeIcon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
    
    // Force editor refresh to apply theme properly
    setTimeout(() => editor.refresh(), 100);
}

function handleEditorChange() {
    clearTimeout(detectTimer);
    const code = editor.getValue();
    
    if (code.trim() === '') {
        updateLanguageDisplay('None');
        setEditorMode('text/plain');
        return;
    }

    updateLanguageDisplay('Detecting...');
    detectTimer = setTimeout(() => detectLanguage(code), 1000);
}

async function detectLanguage(code) {
    const langBadge = document.querySelector('.language-badge');
    langBadge.classList.add('detecting');
    
    try {
        const response = await fetch(`${API_BASE_URL}/detect-language/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Language detection failed');
        }

        const data = await response.json();
        currentLanguage = data.language;
        updateLanguageDisplay(currentLanguage);
        updateEditorMode(currentLanguage);
        document.getElementById('run-btn').disabled = currentLanguage === 'undetected';
    } catch (error) {
        updateLanguageDisplay('Error detecting language');
        console.error('Language detection error:', error);
    } finally {
        langBadge.classList.remove('detecting');
    }
}

function updateLanguageDisplay(language) {
    document.getElementById('detected-language').textContent = 
        language.charAt(0).toUpperCase() + language.slice(1);
}

function updateEditorMode(language) {
    const modeMap = {
        'cpp': 'text/x-c++src',
        'java': 'text/x-java',
        'python': 'text/x-python',
        'undetected': 'text/plain'
    };
    editor.setOption('mode', modeMap[language] || 'text/plain');
}



function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-success';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

async function handleRunCode() {
    const code = editor.getValue();
    const outputElement = document.getElementById('output');
    const spinner = document.querySelector('.loading-spinner');
    
    spinner.classList.remove('hidden');
    
    if (currentLanguage === 'undetected') {
        outputElement.textContent = 'Language undetected, cannot run the code.';
        spinner.classList.add('hidden');
        return;
    }

    outputElement.textContent = 'Running...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/run-code/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                language: currentLanguage
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Code execution failed');
        }

        const data = await response.json();
        outputElement.textContent = data.output;

        if (data.error && data.line) {
            editor.addLineClass(data.line - 1, 'background', 'error-line');
            setTimeout(() => {
                editor.removeLineClass(data.line - 1, 'background', 'error-line');
            }, 3000);
        }
    } catch (error) {
        outputElement.textContent = 'Error executing code. Please try again.';
        console.error('Code execution error:', error);
    } finally {
        spinner.classList.add('hidden');
    }
}

async function handleAnalyzeComplexity() {
    console.log('Analyze button clicked'); // Debug log
    const code = editor.getValue();
    const outputElement = document.getElementById('output');
    const spinner = document.querySelector('.loading-spinner');

    if (!code.trim()) {
        outputElement.textContent = 'Please enter some code to analyze.';
        return;
    }

    spinner.classList.remove('hidden');
    outputElement.textContent = 'Analyzing time complexity...';

    try {
        console.log('Sending request:', code); // Debug log
        const response = await fetch(`${API_BASE_URL}/analyze-time-complexity/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        console.log('Response status:', response.status); // Debug log
        const data = await response.json();
        console.log('Response data:', data); // Debug log

        if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze complexity');
        }

        // Format the output
        let output = 'Time Complexity Analysis:\n\n';
        output += `Complexity: ${data.time_complexity}\n`;
        output += `Explanation: ${getComplexityExplanation(data.time_complexity)}`;
        
        outputElement.textContent = output;
    } catch (error) {
        console.error('Analysis error:', error); // Debug log
        outputElement.textContent = `Error: ${error.message}`;
    } finally {
        spinner.classList.add('hidden');
    }
}

function getComplexityExplanation(complexity) {
    const explanations = {
        'O(1)': 'Constant time - no loops or recursion',
        'O(log n)': 'Logarithmic time - typically divide and conquer algorithms',
        'O(n)': 'Linear time - single loop through the input',
        'O(n log n)': 'Linearithmic time - efficient sorting algorithms',
        'O(2^n)': 'Exponential time - recursive algorithms'
    };

    if (complexity.startsWith('O(n^')) {
        return 'Polynomial time - nested loops';
    }

    return explanations[complexity] || 'Complex algorithm';
}

// Clear the code editor
function clearEditor() {
    editor.setValue('');
    updateLanguageDisplay('None');
    setEditorMode('text/plain');
}

// Copy the output to the clipboard
function copyOutput() {
    const outputElement = document.getElementById('output');
    const text = outputElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Output copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy output:', err);
    });
}

// Adjust the font size of the code editor
function adjustFontSize(change) {
    const currentFontSize = parseInt(window.getComputedStyle(document.querySelector('.CodeMirror')).fontSize, 10);
    const newFontSize = Math.max(10, currentFontSize + change); // Minimum font size is 10px
    document.querySelector('.CodeMirror').style.fontSize = `${newFontSize}px`;
    editor.refresh();
}