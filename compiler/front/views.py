from django.shortcuts import render
from django.http import HttpResponse
import json
import os
import subprocess
import tempfile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import re

# Define token sets at module level
COMMON_TOKENS = {
    'keywords': {'if', 'else', 'for', 'while', 'return', 'break', 'continue'},
    'operators': {'+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>='},
    'symbols': {'(', ')', '{', '}', '[', ']', ';', ',', '.'}
}

PYTHON_TOKENS = {
    'keywords': {'def', 'lambda', 'class', 'import', 'from', 'as', 'try', 'except', 
                 'finally', 'with', 'yield', 'elif', 'not', 'in', 'is', 'and', 'or', 
                 'nonlocal', 'global', 'True', 'False', 'None', 'async', 'await', 'print'},
    'operators': {'**', '//', ':=', '@'},
    'symbols': {':', '->', '#', '"""', "'''"}
}

JAVA_TOKENS = {
    'keywords': {'public', 'private', 'protected', 'static', 'void', 'main', 'String', 
                'class', 'extends', 'implements', 'interface', 'new', 'this', 'super',
                'throws', 'try', 'catch', 'finally', 'int', 'boolean', 'float', 'double'},
    'operators': {'++', '--', 'instanceof'},
    'symbols': {'@'},
    'patterns': [r'System\.out\.println', r'public\s+class']
}

CPP_TOKENS = {
    'keywords': {'public', 'private', 'protected', 'using', 'namespace', 'cout', 'cin', 
                'endl', 'template', 'typename', 'constexpr', 'auto', 'decltype', 
                'noexcept', 'nullptr', 'const_cast', 'dynamic_cast', 'reinterpret_cast', 
                'static_cast', 'virtual', 'override', 'friend', 'operator', 'inline', 
                'mutable', 'explicit', 'typedef', 'union', 'goto', 'wchar_t'},
    'operators': {'->', '::', '<<', '>>', '.*', '->*'},
    'symbols': {'#include', '/*', '*/'}
}

def index(request):
    return HttpResponse("Hello World!")

def main(request):
    return render(request, "front/main.html")

def tokenize(code):
    """Tokenize the input code"""
    code = re.sub(r'"[^"]*"', ' STRING ', code)
    code = re.sub(r"'[^']*'", ' STRING ', code)
    code = re.sub(r'//.*', ' ', code)
    code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.DOTALL)
    return re.findall(r'[a-zA-Z_][\w:]*|\d+\.?\d*|\S', code)

def is_python_token(token):
    """Check if token is Python-specific"""
    return (token in PYTHON_TOKENS['keywords'] or 
            token in PYTHON_TOKENS['operators'] or 
            token in PYTHON_TOKENS['symbols'])

def is_java_token(token):
    """Check if token is Java-specific"""
    if (token in JAVA_TOKENS['keywords'] or 
        token in JAVA_TOKENS['operators'] or 
        token in JAVA_TOKENS['symbols']):
        return True
    # Check patterns in the original code if needed
    return False

def is_cpp_token(token):
    """Check if token is C++-specific"""
    return (token in CPP_TOKENS['keywords'] or 
            token in CPP_TOKENS['operators'] or 
            token in CPP_TOKENS['symbols'])

def is_common_token(token):
    """Check if token is common to all languages"""
    return (token in COMMON_TOKENS['keywords'] or 
            token in COMMON_TOKENS['operators'] or 
            token in COMMON_TOKENS['symbols'])

def detect_language(code):
    """Detect programming language using lexical analysis"""
    tokens = tokenize(code)
    counts = {'python': 0, 'java': 0, 'cpp': 0}

    for token in tokens:
        if is_python_token(token):
            counts['python'] += 1
        elif is_java_token(token):
            counts['java'] += 1
        elif is_cpp_token(token):
            counts['cpp'] += 1

    max_count = max(counts.values())
    if max_count == 0:
        return 'undetected'

    if counts['python'] == max_count:
        return 'python'
    elif counts['java'] == max_count:
        return 'java'
    else:
        return 'cpp'

@csrf_exempt
@require_http_methods(["POST"])
def detect_language_view(request):
    try:
        data = json.loads(request.body)
        code = data.get('code', '')
        language = detect_language(code)
        tokens = tokenize(code)
        token_groups = {
            'python': [t for t in tokens if is_python_token(t)],
            'java': [t for t in tokens if is_java_token(t)],
            'cpp': [t for t in tokens if is_cpp_token(t)],
            'common': [t for t in tokens if is_common_token(t)]
        }
        return JsonResponse({
            'language': language,
            'tokens': token_groups,
            'all_tokens': tokens
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def run_code_view(request):
    try:
        data = json.loads(request.body)
        code = data.get('code', '')
        language = data.get('language', '')
        
        if language == 'python':
            result = run_python(code)
        elif language == 'cpp':
            result = run_cpp(code)
        elif language == 'java':
            result = run_java(code)
        else:
            return JsonResponse({'error': 'Unsupported language'}, status=400)
        
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def ai_debug_view(request):
    return JsonResponse({'message': 'AI debugging feature coming soon'})

def run_python(code):
    try:
        result = subprocess.run(
            ['python', '-c', code],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return {'output': result.stdout}
        return {'error': result.stderr}
    except subprocess.TimeoutExpired:
        return {'error': 'Execution timed out'}
    except Exception as e:
        return {'error': str(e)}

def run_cpp(code):
    with tempfile.TemporaryDirectory() as tmp_dir:
        cpp_file = os.path.join(tmp_dir, 'temp.cpp')
        output_file = os.path.join(tmp_dir, 'output')
        
        with open(cpp_file, 'w') as f:
            f.write(code)
        
        try:
            compile_result = subprocess.run(
                ['g++', cpp_file, '-o', output_file],
                capture_output=True,
                text=True
            )
            if compile_result.returncode != 0:
                return {'error': f'Compilation error:\n{compile_result.stderr}'}
            
            run_result = subprocess.run(
                [output_file],
                capture_output=True,
                text=True,
                timeout=5
            )
            if run_result.returncode == 0:
                return {'output': run_result.stdout}
            return {'error': run_result.stderr}
        except subprocess.TimeoutExpired:
            return {'error': 'Execution timed out'}
        except Exception as e:
            return {'error': str(e)}

def run_java(code):
    with tempfile.TemporaryDirectory() as tmp_dir:
        java_file = os.path.join(tmp_dir, 'Main.java')
        
        with open(java_file, 'w') as f:
            f.write(code)
        
        try:
            compile_result = subprocess.run(
                ['javac', java_file],
                capture_output=True,
                text=True
            )
            if compile_result.returncode != 0:
                return {'error': f'Compilation error:\n{compile_result.stderr}'}
            
            run_result = subprocess.run(
                ['java', '-cp', tmp_dir, 'Main'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if run_result.returncode == 0:
                return {'output': run_result.stdout}
            return {'error': run_result.stderr}
        except subprocess.TimeoutExpired:
            return {'error': 'Execution timed out'}
        except Exception as e:
            return {'error': str(e)}