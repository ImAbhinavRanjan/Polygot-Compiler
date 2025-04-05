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
import ast

# Create your views here.

def index(request):
    return HttpResponse("Hello World!")

def main(request):
    return render(request,"front/main.html")

def detect_language(code):
    """Detect programming language using lexical analysis"""
    # Lexical token definitions (same as original)
    common_tokens = {
        'keywords': {'if', 'else', 'for', 'while', 'return', 'break', 'continue'},
        'operators': {'+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>='},
        'symbols': {'(', ')', '{', '}', '[', ']', ';', ',', '.'}
    }
    
    python_tokens = {
        'keywords': {'def', 'lambda', 'class', 'import', 'from', 'as', 'try', 'except', 
                     'finally', 'with', 'yield', 'elif', 'not', 'in', 'is', 'and', 'or', 
                     'nonlocal', 'global', 'True', 'False', 'None', 'async', 'await', 'print'},
        'operators': {'**', '//', ':=', '@'},
        'symbols': {':', '->', '#', '"""', "'''"}
    }
    
    java_tokens = {
        'keywords': {'public', 'private', 'protected', 'static', 'void', 'main', 'String', 
                    'class', 'extends', 'implements', 'interface', 'new', 'this', 'super',
                    'throws', 'try', 'catch', 'finally', 'int', 'boolean', 'float', 'double'},
        'operators': {'++', '--', 'instanceof'},
        'symbols': {'@'},
        'patterns': [r'System\.out\.println', r'public\s+class']  # NEW: Pattern matching
    }
    
    cpp_tokens = {
        'keywords': {'public', 'private', 'protected', 'using', 'namespace', 'cout', 'cin', 
                    'endl', 'template', 'typename', 'constexpr', 'auto', 'decltype', 
                    'noexcept', 'nullptr', 'const_cast', 'dynamic_cast', 'reinterpret_cast', 
                    'static_cast', 'virtual', 'override', 'friend', 'operator', 'inline', 
                    'mutable', 'explicit', 'typedef', 'union', 'goto', 'wchar_t'},
        'operators': {'->', '::', '<<', '>>', '.*', '->*'},
        'symbols': {'#include', '/*', '*/'}
    }

    # Tokenize function
    def tokenize(code):
        code = re.sub(r'"[^"]*"', ' STRING ', code)
        code = re.sub(r"'[^']*'", ' STRING ', code)
        code = re.sub(r'//.*', ' ', code)
        code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.DOTALL)
        return re.findall(r'[a-zA-Z_][\w:]*|\d+\.?\d*|\S', code)

    # Classification functions
    def is_python_token(token):
        return (token in python_tokens['keywords'] or 
                token in python_tokens['operators'] or 
                token in python_tokens['symbols'])

    def is_java_token(token):
        # Check basic tokens
        if (token in java_tokens['keywords'] or 
            token in java_tokens['operators'] or 
            token in java_tokens['symbols']):
            return True

    def is_cpp_token(token):
        return (token in cpp_tokens['keywords'] or 
                token in cpp_tokens['operators'] or 
                token in cpp_tokens['symbols'])

    # Main detection logic
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
        return JsonResponse({'language': language})
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
def analyze_time_complexity_view(request):
    try:
        data = json.loads(request.body)
        code = data.get('code', '').strip()
        if not code:
            return JsonResponse({'error': 'Code cannot be empty'}, status=400)

        # Analyze time complexity
        complexity = analyze_time_complexity(code)
        return JsonResponse({'time_complexity': complexity})
    except Exception as e:
        return JsonResponse({'error': f"Time Complexity Analysis failed: {str(e)}"}, status=500)

def analyze_time_complexity(code):
    """
    Analyze the time complexity of code using static analysis.
    """
    try:
        tree = ast.parse(code)
        analyzer = TimeComplexityAnalyzer()
        return analyzer.analyze(tree)
    except Exception as e:
        return f"Error analyzing code: {str(e)}"

class TimeComplexityAnalyzer:
    def __init__(self):
        self.complexity = "O(1)"
        self.loop_depth = 0
        self.recursive_calls = 0
        self.has_divide_and_conquer = False

    def analyze(self, tree):
        self.visit(tree)
        if self.recursive_calls > 0:
            if self.has_divide_and_conquer:
                return "O(n log n) (Divide and Conquer)"
            return "O(2^n) (Recursive)"
        elif self.loop_depth == 1:
            return "O(n)"
        elif self.loop_depth > 1:
            return f"O(n^{self.loop_depth})"
        return self.complexity

    def visit(self, node):
        if isinstance(node, ast.For) or isinstance(node, ast.While):
            self.loop_depth += 1
            for child in ast.iter_child_nodes(node):
                self.visit(child)
            self.loop_depth -= 1
        elif isinstance(node, ast.FunctionDef):
            self._analyze_function(node)
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
            self.has_divide_and_conquer = True
        else:
            for child in ast.iter_child_nodes(node):
                self.visit(child)

    def _analyze_function(self, node):
        # Check for recursive calls
        for child in ast.walk(node):
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Name) and child.func.id == node.name:
                self.recursive_calls += 1

class RecursiveCallVisitor(ast.NodeVisitor):
    def __init__(self, func_name):
        self.func_name = func_name
        self.has_recursion = False
    
    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id == self.func_name:
            self.has_recursion = True
        self.generic_visit(node)

def run_python(code):
    try:
        if not code.strip():
            return {'error': 'Code cannot be empty'}
        result = subprocess.run(
            ['python', '-c', code],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return {'output': result.stdout.strip()}
        return {'error': result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {'error': 'Execution timed out'}
    except Exception as e:
        return {'error': f"Python execution failed: {str(e)}"}

def run_cpp(code):
    try:
        if not code.strip():
            return {'error': 'Code cannot be empty'}
        with tempfile.TemporaryDirectory() as tmp_dir:
            cpp_file = os.path.join(tmp_dir, 'temp.cpp')
            output_file = os.path.join(tmp_dir, 'output')

            with open(cpp_file, 'w') as f:
                f.write(code)

            # Compile
            compile_result = subprocess.run(
                ['g++', cpp_file, '-o', output_file],
                capture_output=True,
                text=True
            )
            if compile_result.returncode != 0:
                return {'error': f'Compilation error:\n{compile_result.stderr.strip()}'}

            # Run
            run_result = subprocess.run(
                [output_file],
                capture_output=True,
                text=True,
                timeout=5
            )
            if run_result.returncode == 0:
                return {'output': run_result.stdout.strip()}
            return {'error': run_result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {'error': 'Execution timed out'}
    except Exception as e:
        return {'error': f"C++ execution failed: {str(e)}"}

def run_java(code):
    try:
        if not code.strip():
            return {'error': 'Code cannot be empty'}
        with tempfile.TemporaryDirectory() as tmp_dir:
            java_file = os.path.join(tmp_dir, 'Main.java')

            with open(java_file, 'w') as f:
                f.write(code)

            # Compile
            compile_result = subprocess.run(
                ['javac', java_file],
                capture_output=True,
                text=True
            )
            if compile_result.returncode != 0:
                return {'error': f'Compilation error:\n{compile_result.stderr.strip()}'}

            # Run
            run_result = subprocess.run(
                ['java', '-cp', tmp_dir, 'Main'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if run_result.returncode == 0:
                return {'output': run_result.stdout.strip()}
            return {'error': run_result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {'error': 'Execution timed out'}
    except Exception as e:
        return {'error': f"Java execution failed: {str(e)}"}