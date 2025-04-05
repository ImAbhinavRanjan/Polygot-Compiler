let editor;
let currentLanguage = 'undetected';
let detectTimer = null;
let isDarkTheme = true;
const API_BASE_URL = 'http://127.0.0.1:8000/front';  // Base URL without the '/front' suffix

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeEditor();
    setupSplitPane();
    setupEventListeners();
});

function initializeTheme() {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    const themeIcon = document.querySelector('#theme-toggle i');
    themeIcon.className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
}

function initializeEditor() {
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
    editor.refresh();
}

function setupSplitPane() {
    if (window.innerWidth > 768) {
        Split(['#split-container .editor-section', '#split-container .result-section'], {
            sizes: [60, 40],
            minSize: [300, 300],
            gutterSize: 10,
            snapOffset: 0,
            onDragEnd: () => editor.refresh()
        });
    }
}

function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Editor events
    editor.on('change', handleEditorChange);
    
    // Button events
    document.getElementById('run-btn').addEventListener('click', handleRunCode);
    document.getElementById('ai-debug-btn').addEventListener('click', () => {
        alert('AI Debug feature coming soon.');
    });
    document.getElementById('show-tokens-btn').addEventListener('click', toggleTokenDisplay);
    document.getElementById('template-select').addEventListener('change', loadTemplate);
    document.getElementById('copy-code').addEventListener('click', copyCode);
    document.getElementById('clear-editor').addEventListener('click', clearEditor);
    document.getElementById('download-code').addEventListener('click', downloadCode);
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('upload-code').click());
    document.getElementById('upload-code').addEventListener('change', uploadCode);
    document.getElementById('font-increase').addEventListener('click', () => changeFontSize(1));
    document.getElementById('font-decrease').addEventListener('click', () => changeFontSize(-1));
    
    // Window events
    window.addEventListener('load', () => setTimeout(() => editor.refresh(), 100));
    window.addEventListener('resize', () => editor.refresh());
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    editor.setOption('theme', isDarkTheme ? 'dracula' : 'default');
    document.querySelector('#theme-toggle i').className = isDarkTheme ? 'fas fa-moon' : 'fas fa-sun';
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

async function toggleTokenDisplay() {
    const tokenDisplay = document.getElementById('token-display');
    const tokenDetails = document.getElementById('token-details');
    const button = document.getElementById('show-tokens-btn');
    
    try {
        if (tokenDisplay.style.display === 'none') {
            const response = await fetch(`${API_BASE_URL}/detect-language/`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ code: editor.getValue() })
            });

            if (!response.ok) throw new Error('Token detection failed');
            
            const data = await response.json();
            let html = `<p><strong>Detected Language:</strong> ${data.language}</p>`;
            html += `<p><strong>All Tokens:</strong> ${data.all_tokens.join(', ')}</p>`;
            
            for (const [lang, tokens] of Object.entries(data.tokens)) {
                if (tokens.length > 0) {
                    html += `<p><strong>${lang.toUpperCase()} Tokens:</strong> ${tokens.join(', ')}</p>`;
                }
            }
            
            tokenDetails.innerHTML = html;
            tokenDisplay.style.display = 'block';
            button.textContent = 'Hide Tokens';
        } else {
            tokenDisplay.style.display = 'none';
            button.textContent = 'Show Detected Tokens';
        }
    } catch (error) {
        console.error('Token display error:', error);
        showNotification('Failed to analyze tokens');
    }
}

async function handleRunCode() {
    const code = editor.getValue();
    const outputElement = document.getElementById('output');
    const spinner = document.querySelector('.loading-spinner');
    
    spinner.classList.remove('hidden');
    outputElement.textContent = 'Running...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/run-code/`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
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
        outputElement.textContent = data.output || data.error || 'No output';

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

// Helper functions
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-success';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// Placeholder functions for other features
function loadTemplate() { /* ... */ }
function copyCode() { /* ... */ }
function clearEditor() { /* ... */ }
function downloadCode() { /* ... */ }
function uploadCode() { /* ... */ }
function changeFontSize() { /* ... */ }