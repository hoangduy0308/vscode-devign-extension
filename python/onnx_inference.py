#!/usr/bin/env python3
"""
ONNX Inference Module for Devign Vulnerability Detection.

Provides high-performance inference using ONNX Runtime instead of PyTorch.
Target: p50 <100ms latency per function.

Usage:
    from onnx_inference import ONNXModelWrapper, get_onnx_model_wrapper
    
    wrapper = get_onnx_model_wrapper()
    result = wrapper.predict(code)
"""

import json
import re
import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
import time

import numpy as np

# Try to import ONNX Runtime
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    print("Warning: onnxruntime not installed. Install with: pip install onnxruntime", file=sys.stderr)

logger = logging.getLogger(__name__)

# Paths
SCRIPT_DIR = Path(__file__).parent.resolve()
CACHE_DIR = Path.home() / "AppData" / "Local" / "devign-scanner" / "models" / "latest"

# Model configuration
MAX_LEN = 512
NUM_SLICES = 6
SLICE_LEN = 256
VULN_DIM = 26

# Default ONNX model path
DEFAULT_ONNX_PATH = SCRIPT_DIR / "devign_model.onnx"


@dataclass
class PredictionResponse:
    """Prediction result from the model."""
    vulnerable: bool
    score: float
    threshold: float
    confidence: str
    detected_patterns: List[str] = field(default_factory=list)
    latency_ms: float = 0.0


# Token patterns for C code
C_KEYWORDS = {
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
    'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
    'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
    'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while',
    'NULL', 'true', 'false', 'nullptr'
}

COMMON_STDLIB_FUNCS = {
    'printf', 'scanf', 'malloc', 'calloc', 'realloc', 'free',
    'memcpy', 'memset', 'memmove', 'memcmp', 'strlen', 'strcpy',
    'strncpy', 'strcat', 'strncat', 'strcmp', 'strncmp', 'strchr',
    'strrchr', 'strstr', 'sprintf', 'snprintf', 'sscanf', 'fprintf',
    'fscanf', 'fopen', 'fclose', 'fread', 'fwrite', 'fgets', 'fputs',
    'exit', 'abort', 'atoi', 'atol', 'atof', 'strtol', 'getchar', 'putchar',
    'gets', 'puts', 'getenv', 'system', 'assert', 'perror', 'open', 'close',
    'read', 'write', 'alloca', 'vprintf', 'vsnprintf', 'vsprintf'
}

DANGEROUS_FUNCTIONS = [
    'strcpy', 'strcat', 'gets', 'sprintf', 'memcpy', 'memmove',
    'scanf', 'fscanf', 'sscanf', 'vsprintf', 'vprintf'
]


def strip_comments(code: str) -> str:
    """Remove C/C++ comments."""
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    code = re.sub(r'//.*?$', '', code, flags=re.MULTILINE)
    return code


def tokenize_c_code(code: str) -> List[str]:
    """Tokenize C code into tokens."""
    clean_code = strip_comments(code)
    
    patterns = [
        (r'"(?:[^"\\]|\\.)*"', 'STR'),
        (r"'(?:[^'\\]|\\.)*'", 'CHAR'),
        (r'0[xX][0-9a-fA-F]+[uUlL]*', 'NUM'),
        (r'0[bB][01]+[uUlL]*', 'NUM'),
        (r'\d+\.?\d*(?:[eE][+-]?\d+)?[fFlLuU]*', 'NUM'),
        (r'\.\d+(?:[eE][+-]?\d+)?[fFlL]*', 'NUM'),
        (r'\.\.\.', None),
        (r'::', None),
        (r'->', None),
        (r'\+\+|--', None),
        (r'<<=|>>=', None),
        (r'<<|>>', None),
        (r'<=|>=|==|!=', None),
        (r'&&|\|\|', None),
        (r'[+\-*/%&|^~!=<>]=', None),
        (r'[+\-*/%&|^~!=<>?:#]', None),
        (r'[a-zA-Z_][a-zA-Z0-9_]*', 'ID'),
        (r'[{}()\[\];,.]', None),
    ]
    
    compiled = [(re.compile(p), t) for p, t in patterns]
    tokens = []
    pos = 0
    
    while pos < len(clean_code):
        if clean_code[pos].isspace():
            pos += 1
            continue
        
        matched = False
        for pattern, token_type in compiled:
            match = pattern.match(clean_code, pos)
            if match:
                text = match.group()
                if token_type == 'STR':
                    tokens.append('STR')
                elif token_type == 'CHAR':
                    tokens.append('CHAR')
                elif token_type == 'NUM':
                    tokens.append('NUM')
                else:
                    tokens.append(text)
                pos = match.end()
                matched = True
                break
        
        if not matched:
            pos += 1
    
    return tokens


def normalize_tokens(tokens: List[str]) -> List[str]:
    """Normalize tokens for model input."""
    normalized = []
    var_map: Dict[str, str] = {}
    func_map: Dict[str, str] = {}
    var_counter = 0
    func_counter = 0
    
    for i, token in enumerate(tokens):
        if token in C_KEYWORDS:
            normalized.append(token)
        elif token in ('NUM', 'STR', 'CHAR'):
            normalized.append(token)
        elif token in COMMON_STDLIB_FUNCS:
            normalized.append(token)
        elif re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', token):
            next_token = tokens[i + 1] if i + 1 < len(tokens) else None
            is_func = next_token == '('
            
            if is_func:
                if token not in func_map:
                    func_map[token] = f'FUNC_{func_counter}'
                    func_counter += 1
                normalized.append(func_map[token])
            else:
                if token not in var_map:
                    var_map[token] = f'VAR_{var_counter}'
                    var_counter += 1
                normalized.append(var_map[token])
        else:
            normalized.append(token)
    
    return normalized


def extract_vuln_features(code: str) -> np.ndarray:
    """Extract 26 vulnerability features."""
    feats = []
    
    loc = code.count('\n') + 1
    feats.append(loc)
    
    stmt_count = code.count(';')
    feats.append(stmt_count)
    
    dangerous_count = 0
    for func in DANGEROUS_FUNCTIONS:
        dangerous_count += len(re.findall(rf'\b{func}\s*\(', code))
    feats.append(dangerous_count)
    
    if_count = len(re.findall(r'\bif\s*\(', code))
    feats.append(max(0, dangerous_count - if_count))
    feats.append(dangerous_count / max(1, stmt_count) if stmt_count else 0)
    
    ptr_deref = code.count('->') + code.count('*')
    feats.append(ptr_deref)
    
    null_checks = len(re.findall(r'\bNULL\b', code)) + len(re.findall(r'!=\s*NULL', code))
    feats.append(max(0, ptr_deref - null_checks))
    feats.append(max(0, ptr_deref - null_checks) / max(1, ptr_deref) if ptr_deref else 0)
    
    array_access = code.count('[')
    feats.append(array_access)
    
    bounds_checks = len(re.findall(r'<\s*\w+', code)) + len(re.findall(r'>\s*0', code))
    feats.append(max(0, array_access - bounds_checks))
    feats.append(max(0, array_access - bounds_checks) / max(1, array_access) if array_access else 0)
    
    malloc_count = len(re.findall(r'\bmalloc\s*\(', code)) + len(re.findall(r'\bcalloc\s*\(', code))
    feats.append(malloc_count)
    
    free_count = len(re.findall(r'\bfree\s*\(', code))
    feats.append(max(0, malloc_count - free_count))
    feats.append(max(0, malloc_count - free_count) / max(1, malloc_count) if malloc_count else 0)
    
    feats.append(free_count)
    feats.append(max(0, free_count - null_checks))
    feats.append(max(0, free_count - null_checks) / max(1, free_count) if free_count else 0)
    
    func_calls = len(re.findall(r'\b\w+\s*\(', code))
    feats.append(max(0, func_calls - if_count))
    feats.append(max(0, func_calls - if_count) / max(1, func_calls) if func_calls else 0)
    
    feats.append(null_checks)
    feats.append(bounds_checks)
    feats.append((null_checks + bounds_checks) / max(1, dangerous_count + ptr_deref + array_access))
    
    feats.append(dangerous_count / max(1, loc))
    feats.append(ptr_deref / max(1, loc))
    feats.append(array_access / max(1, loc))
    feats.append(null_checks / max(1, loc))
    
    if len(feats) < VULN_DIM:
        feats.extend([0.0] * (VULN_DIM - len(feats)))
    else:
        feats = feats[:VULN_DIM]
    
    return np.array(feats, dtype=np.float32)


def detect_critical_patterns(code: str) -> Tuple[float, List[str]]:
    """Detect critical vulnerability patterns."""
    boost_score = 0.0
    detected_patterns = []
    
    if re.search(r'\bgets\s*\(', code):
        boost_score += 0.15
        detected_patterns.append("gets() - buffer overflow risk")
    
    format_funcs = ['printf', 'sprintf', 'fprintf', 'vprintf', 'vsprintf']
    for func in format_funcs:
        pattern = rf'\b{func}\s*\(\s*([^",\)]+)\s*\)'
        matches = re.findall(pattern, code)
        for match in matches:
            if not match.strip().startswith('"'):
                boost_score += 0.12
                detected_patterns.append(f"{func}(user_input) - format string vulnerability")
                break
    
    for func in ['strcpy', 'strcat']:
        if re.search(rf'\b{func}\s*\(', code):
            safe_version = func.replace('cpy', 'ncpy').replace('cat', 'ncat')
            if not re.search(rf'\b{safe_version}\s*\(', code):
                if not re.search(r'\bsizeof\s*\(', code) and not re.search(r'\bstrlen\s*\(', code):
                    boost_score += 0.10
                    detected_patterns.append(f"{func}() without bounds check")
    
    malloc_matches = list(re.finditer(r'(\w+)\s*=\s*(\(?\s*\w+\s*\*?\s*\)?)\s*malloc\s*\(', code))
    for match in malloc_matches:
        var_name = match.group(1)
        after_malloc = code[match.end():]
        null_check_pattern = rf'\bif\s*\(\s*{re.escape(var_name)}\s*(==\s*NULL|!=\s*NULL|!|==\s*0|!=\s*0)'
        if not re.search(null_check_pattern, after_malloc[:200]):
            boost_score += 0.08
            detected_patterns.append(f"malloc() without NULL check for '{var_name}'")
            break
    
    return (boost_score, detected_patterns)


class ONNXModelWrapper:
    """High-performance ONNX inference wrapper for Devign model."""
    
    def __init__(
        self,
        onnx_path: Optional[Path] = None,
        vocab_path: Optional[Path] = None,
        feature_stats_path: Optional[Path] = None,
        threshold: float = 0.65,
        num_threads: int = 4,
    ):
        if not ONNX_AVAILABLE:
            raise ImportError("onnxruntime not installed")
        
        # Find paths
        self.onnx_path = onnx_path or DEFAULT_ONNX_PATH
        if not self.onnx_path.exists():
            raise FileNotFoundError(f"ONNX model not found: {self.onnx_path}")
        
        self.vocab_path = vocab_path or (CACHE_DIR / "models" / "vocab.json")
        self.feature_stats_path = feature_stats_path or (CACHE_DIR / "models" / "feature_stats.json")
        
        self.threshold = threshold
        self.max_len = MAX_LEN
        self.num_slices = NUM_SLICES
        self.slice_len = SLICE_LEN
        
        # Load vocab
        self.vocab = self._load_vocab()
        self.feature_stats = self._load_feature_stats()
        
        # Create ONNX session
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.intra_op_num_threads = num_threads
        sess_options.inter_op_num_threads = 1
        
        # Try GPU first, fallback to CPU
        providers = ['CPUExecutionProvider']
        try:
            if 'CUDAExecutionProvider' in ort.get_available_providers():
                providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        except:
            pass
        
        self.session = ort.InferenceSession(
            str(self.onnx_path), 
            sess_options,
            providers=providers
        )
        
        logger.info(f"Loaded ONNX model from {self.onnx_path}")
        logger.info(f"Providers: {self.session.get_providers()}")
    
    def _load_vocab(self) -> Dict[str, int]:
        """Load vocabulary mapping."""
        if self.vocab_path.exists():
            data = json.loads(self.vocab_path.read_text())
            return data.get("token2id", {})
        return {"<PAD>": 0, "<UNK>": 1, "<BOS>": 2, "<EOS>": 3}
    
    def _load_feature_stats(self) -> Dict[str, Any]:
        """Load feature normalization stats."""
        if self.feature_stats_path.exists():
            data = json.loads(self.feature_stats_path.read_text())
            return data.get("feature_stats", {})
        return {}
    
    def _preprocess(self, code: str) -> Dict[str, np.ndarray]:
        """Preprocess code into model inputs."""
        tokens = tokenize_c_code(code)
        normalized = normalize_tokens(tokens)
        
        pad_id = self.vocab.get("<PAD>", 0)
        unk_id = self.vocab.get("<UNK>", 1)
        bos_id = self.vocab.get("<BOS>", 2)
        eos_id = self.vocab.get("<EOS>", 3)
        
        # Global sequence
        global_ids = [bos_id]
        for t in normalized[:self.max_len - 2]:
            global_ids.append(self.vocab.get(t, unk_id))
        global_ids.append(eos_id)
        
        input_ids = np.full((1, self.max_len), pad_id, dtype=np.int64)
        attention_mask = np.zeros((1, self.max_len), dtype=np.float32)
        length = min(len(global_ids), self.max_len)
        input_ids[0, :length] = global_ids[:length]
        attention_mask[0, :length] = 1.0
        
        # Slices
        slices = []
        for start in range(0, len(normalized), self.slice_len - 2):
            if len(slices) >= self.num_slices:
                break
            end = min(start + self.slice_len - 2, len(normalized))
            slices.append(normalized[start:end])
        
        while len(slices) < self.num_slices:
            slices.append([])
        
        slice_input_ids = np.full((1, self.num_slices, self.slice_len), pad_id, dtype=np.int64)
        slice_attention_mask = np.zeros((1, self.num_slices, self.slice_len), dtype=np.float32)
        valid_slices = 0
        
        for s_idx, slice_tokens in enumerate(slices):
            if not slice_tokens:
                continue
            
            ids = [bos_id]
            for t in slice_tokens[:self.slice_len - 2]:
                ids.append(self.vocab.get(t, unk_id))
            ids.append(eos_id)
            
            length = min(len(ids), self.slice_len)
            slice_input_ids[0, s_idx, :length] = ids[:length]
            slice_attention_mask[0, s_idx, :length] = 1.0
            valid_slices += 1
        
        slice_count = np.array([max(1, valid_slices)], dtype=np.int64)
        
        # Vuln features
        vuln_features = self._extract_and_normalize_features(code)
        
        # Slice features (zeros for now)
        slice_vuln_features = np.zeros((1, self.num_slices, VULN_DIM), dtype=np.float32)
        slice_rel_features = np.zeros((1, self.num_slices, VULN_DIM), dtype=np.float32)
        
        return {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "slice_input_ids": slice_input_ids,
            "slice_attention_mask": slice_attention_mask,
            "slice_count": slice_count,
            "vuln_features": vuln_features,
            "slice_vuln_features": slice_vuln_features,
            "slice_rel_features": slice_rel_features,
        }
    
    def _extract_and_normalize_features(self, code: str) -> np.ndarray:
        """Extract and normalize vulnerability features."""
        feats = extract_vuln_features(code)
        
        if self.feature_stats:
            feature_names = [
                "loc", "stmt_count", "dangerous_call_count",
                "dangerous_call_without_check_count", "dangerous_call_without_check_ratio",
                "pointer_deref_count", "pointer_deref_without_null_check_count",
                "pointer_deref_without_null_check_ratio", "array_access_count",
                "array_access_without_bounds_check_count", "array_access_without_bounds_check_ratio",
                "malloc_count", "malloc_without_free_count", "malloc_without_free_ratio",
                "free_count", "free_without_null_check_count", "free_without_null_check_ratio",
                "unchecked_return_value_count", "unchecked_return_value_ratio",
                "null_check_count", "bounds_check_count", "defense_ratio",
                "dangerous_call_density", "pointer_deref_density",
                "array_access_density", "null_check_density"
            ]
            
            for i, name in enumerate(feature_names):
                if i >= len(feats):
                    break
                stats = self.feature_stats.get(name, {})
                mean = stats.get("mean", 0.0)
                std = stats.get("std", 1.0)
                if std == 0:
                    std = 1.0
                feats[i] = (feats[i] - mean) / std
        
        return feats.reshape(1, -1)
    
    def _softmax(self, logits: np.ndarray) -> np.ndarray:
        """Apply softmax to logits."""
        exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
        return exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)
    
    def _get_confidence(self, score: float) -> str:
        """Get confidence level from score."""
        if score > 0.8 or score < 0.2:
            return "high"
        elif score > 0.6 or score < 0.4:
            return "medium"
        return "low"
    
    def predict(self, code: str) -> PredictionResponse:
        """Predict vulnerability in code."""
        start_time = time.perf_counter()
        
        # Preprocess
        inputs = self._preprocess(code)
        
        # Run inference
        outputs = self.session.run(None, inputs)
        logits = outputs[0]
        
        # Get probability
        probs = self._softmax(logits)
        prob = float(probs[0, 1])
        
        # Apply pattern boost
        boost_score, detected_patterns = detect_critical_patterns(code)
        adjusted_prob = min(1.0, prob + boost_score)
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        return PredictionResponse(
            vulnerable=adjusted_prob >= self.threshold,
            score=round(adjusted_prob, 4),
            threshold=self.threshold,
            confidence=self._get_confidence(adjusted_prob),
            detected_patterns=detected_patterns,
            latency_ms=round(latency_ms, 2),
        )


# Singleton wrapper
_onnx_model_wrapper: Optional[ONNXModelWrapper] = None


def get_onnx_model_wrapper(onnx_path: Optional[Path] = None) -> ONNXModelWrapper:
    """Get singleton ONNX model wrapper."""
    global _onnx_model_wrapper
    if _onnx_model_wrapper is None:
        _onnx_model_wrapper = ONNXModelWrapper(onnx_path=onnx_path)
    return _onnx_model_wrapper


if __name__ == "__main__":
    # Simple test
    test_code = """
    void vulnerable_function(char *user_input) {
        char buffer[64];
        strcpy(buffer, user_input);
        printf(buffer);
    }
    """
    
    try:
        wrapper = get_onnx_model_wrapper()
        result = wrapper.predict(test_code)
        print(f"Vulnerable: {result.vulnerable}")
        print(f"Score: {result.score}")
        print(f"Confidence: {result.confidence}")
        print(f"Patterns: {result.detected_patterns}")
        print(f"Latency: {result.latency_ms}ms")
    except Exception as e:
        print(f"Error: {e}")
