#!/usr/bin/env python3
"""
VS Code Scanner Bridge for Devign Vulnerability Detection.

This script provides a simplified interface for VS Code extension
to communicate with the Devign vulnerability detector.

Uses HierarchicalBiGRU model with attention-based localization.
"""

import argparse
import hashlib
import json
import sys
import os
import tempfile
import urllib.request
import zipfile
import shutil
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Protocol
from abc import ABC, abstractmethod

SCRIPT_DIR = Path(__file__).parent.resolve()

# GitHub Release configuration
GITHUB_REPO = "hoangduy0308/C-Vul-Devign"
GITHUB_RELEASE_TAG = "v1.0.0"
MODEL_ZIP_NAME = "devign-scanner.zip"

EXPECTED_CHECKSUMS = {
    MODEL_ZIP_NAME: "PLACEHOLDER_UPDATE_WITH_ACTUAL_SHA256_HASH_OF_DEVIGN_SCANNER_ZIP",
}


def compute_sha256(file_path: Path) -> str:
    """Compute SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def verify_file_integrity(file_path: Path, expected_hash: str) -> bool:
    """Verify file integrity using SHA-256 checksum."""
    actual_hash = compute_sha256(file_path)
    if actual_hash != expected_hash:
        raise ValueError(
            f"Integrity check failed for {file_path.name}!\n"
            f"Expected: {expected_hash}\n"
            f"Actual:   {actual_hash}\n"
            f"The downloaded file may be corrupted or tampered with."
        )
    return True


def get_default_cache_dir() -> Path:
    """Get default cache directory for models."""
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    return base / "devign-scanner" / "models"


def safe_extract(zip_file: zipfile.ZipFile, dest_dir: Path) -> None:
    """Safely extract zip file, preventing Zip Slip path traversal attacks."""
    dest_dir_str = os.path.realpath(str(dest_dir))
    
    for member in zip_file.namelist():
        member_path = os.path.realpath(os.path.join(dest_dir_str, member))
        
        if not member_path.startswith(dest_dir_str + os.sep) and member_path != dest_dir_str:
            raise ValueError(f"Attempted path traversal in zip: {member}")
        
        info = zip_file.getinfo(member)
        if info.external_attr >> 28 == 0xA:
            raise ValueError(f"Symlinks not allowed in zip: {member}")
    
    zip_file.extractall(dest_dir)


def download_file(url: str, dest: Path, show_progress: bool = True) -> bool:
    """Download a file from URL to destination."""
    try:
        if show_progress:
            print(f"Downloading {url}...", file=sys.stderr)
        
        request = urllib.request.Request(url)
        request.add_header('User-Agent', 'DevignScanner/1.0')
        
        with urllib.request.urlopen(request, timeout=60) as response:
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, 'wb') as f:
                shutil.copyfileobj(response, f)
        
        if show_progress:
            print(f"Downloaded: {dest.name}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"Download failed: {e}", file=sys.stderr)
        return False


def download_models_from_github(cache_dir: Path, force: bool = False) -> Optional[Path]:
    """Download model files from GitHub Releases."""
    model_dir = cache_dir / GITHUB_RELEASE_TAG
    
    if not force and model_dir.exists():
        required_files = ["vocab.json", "config.json"]
        pt_files = list(model_dir.glob("*.pt"))
        if all((model_dir / f).exists() for f in required_files) and pt_files:
            print(f"Models already exist at {model_dir}", file=sys.stderr)
            return model_dir
    
    model_dir.mkdir(parents=True, exist_ok=True)
    
    base_url = f"https://github.com/{GITHUB_REPO}/releases/download/{GITHUB_RELEASE_TAG}"
    
    print(f"Downloading models from GitHub Release {GITHUB_RELEASE_TAG}...", file=sys.stderr)
    zip_url = f"{base_url}/{MODEL_ZIP_NAME}"
    zip_path = model_dir / MODEL_ZIP_NAME
    
    if download_file(zip_url, zip_path):
        try:
            expected_hash = EXPECTED_CHECKSUMS.get(MODEL_ZIP_NAME)
            if expected_hash and not expected_hash.startswith("PLACEHOLDER"):
                print("Verifying download integrity...", file=sys.stderr)
                verify_file_integrity(zip_path, expected_hash)
                print("Integrity check passed!", file=sys.stderr)
            else:
                print("WARNING: Skipping integrity check - no valid checksum configured", file=sys.stderr)
            
            print("Extracting models...", file=sys.stderr)
            with zipfile.ZipFile(zip_path, 'r') as zf:
                safe_extract(zf, model_dir)
            zip_path.unlink()
            
            for subdir in model_dir.iterdir():
                if subdir.is_dir():
                    for f in subdir.glob("*.pt"):
                        shutil.move(str(f), str(model_dir / f.name))
                    for f in subdir.glob("*.json"):
                        if not (model_dir / f.name).exists():
                            shutil.move(str(f), str(model_dir / f.name))
                    nested_models = subdir / "models"
                    if nested_models.exists():
                        for f in nested_models.glob("*"):
                            shutil.move(str(f), str(model_dir / f.name))
            
            print("Models extracted successfully!", file=sys.stderr)
        except Exception as e:
            print(f"Failed to extract {MODEL_ZIP_NAME}: {e}", file=sys.stderr)
            return None
    else:
        print(f"Failed to download {MODEL_ZIP_NAME}", file=sys.stderr)
        return None
    
    pt_files = list(model_dir.glob("*.pt"))
    if (model_dir / "vocab.json").exists() and pt_files:
        return model_dir
    
    return None


class DevignEngine(ABC):
    """Abstract base class for vulnerability detection engines."""
    
    @abstractmethod
    def scan_file(self, file_path: str) -> Dict[str, Any]:
        """Scan a single file for vulnerabilities."""
        pass
    
    @abstractmethod
    def scan_code(self, code: str) -> Dict[str, Any]:
        """Scan code snippet for vulnerabilities."""
        pass


class PipelineEngine(DevignEngine):
    """Engine using HierarchicalBiGRU with attention-based localization."""
    
    C_EXTENSIONS = {'.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'}
    
    DANGEROUS_APIS = [
        'strcpy', 'strcat', 'sprintf', 'vsprintf', 'gets', 'scanf',
        'sscanf', 'fscanf', 'memcpy', 'memmove', 'strncpy', 'strncat',
        'malloc', 'calloc', 'realloc', 'free', 'alloca'
    ]
    
    def __init__(
        self,
        model_dir: Path,
        threshold: float = 0.36,
        device: str = "auto"
    ):
        self.model_dir = model_dir
        self.threshold = threshold
        self.device = device
        self.model_wrapper = None
        self._init_model()
    
    def _init_model(self):
        """Initialize the HierarchicalBiGRU model wrapper."""
        sys.path.insert(0, str(SCRIPT_DIR))
        sys.path.insert(0, str(self.model_dir))
        
        try:
            from devign_pipeline.api.inference import ModelWrapper
            
            self.model_wrapper = ModelWrapper(
                model_dir=self.model_dir,
                threshold=self.threshold,
                use_graph_slicing=True,
                use_graph_postprocessing=True,
            )
        except ImportError as e:
            raise ImportError(f"Failed to import devign_pipeline: {e}")
    
    def _get_risk_level(self, probability: float) -> str:
        """Convert probability to risk level."""
        if probability >= 0.8:
            return "CRITICAL"
        elif probability >= 0.6:
            return "HIGH"
        elif probability >= self.threshold:
            return "MEDIUM"
        elif probability >= 0.2:
            return "LOW"
        return "SAFE"
    
    def _find_dangerous_lines_regex(self, file_path: str) -> List[Dict[str, Any]]:
        """Find dangerous API calls using regex (fallback/supplement)."""
        dangerous_lines = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                for api in self.DANGEROUS_APIS:
                    match = re.search(rf'\b{api}\s*\(', line)
                    if match:
                        if api in ['strcpy', 'strcat', 'sprintf', 'gets', 'scanf']:
                            severity = 'CRITICAL'
                            message = f'Dangerous function {api}() - high risk of buffer overflow'
                        elif api in ['malloc', 'calloc', 'realloc']:
                            severity = 'HIGH'
                            message = f'Memory allocation {api}() - check return value and free properly'
                        elif api == 'free':
                            severity = 'MEDIUM'
                            message = 'free() call - ensure pointer is valid and set to NULL after'
                        else:
                            severity = 'MEDIUM'
                            message = f'Potentially dangerous function {api}()'
                        
                        dangerous_lines.append({
                            'line': line_num,
                            'column_start': match.start(),
                            'column_end': match.end(),
                            'severity': severity,
                            'api': api,
                            'message': message,
                            'code': line.strip()
                        })
                        break
        except Exception:
            pass
        
        return dangerous_lines
    
    def _convert_highlights_to_dangerous_lines(
        self, 
        highlights: List[Any],
        file_path: str,
        code: str
    ) -> List[Dict[str, Any]]:
        """Convert model attention highlights to dangerous_lines format."""
        dangerous_lines = []
        lines = code.split('\n')
        
        for highlight in highlights:
            line_num = highlight.line
            code_snippet = highlight.code_snippet
            norm_score = highlight.normalized_score
            
            if norm_score >= 0.7:
                severity = 'CRITICAL'
            elif norm_score >= 0.5:
                severity = 'HIGH'
            elif norm_score >= 0.3:
                severity = 'MEDIUM'
            else:
                severity = 'LOW'
            
            detected_api = None
            for api in self.DANGEROUS_APIS:
                if re.search(rf'\b{api}\s*\(', code_snippet):
                    detected_api = api
                    break
            
            col_start = 0
            col_end = len(code_snippet)
            if detected_api:
                match = re.search(rf'\b{detected_api}\s*\(', code_snippet)
                if match:
                    col_start = match.start()
                    col_end = match.end()
            
            message = f'Model attention indicates potential vulnerability (score: {norm_score:.2f})'
            if detected_api:
                message = f'{detected_api}() - {message}'
            
            dangerous_lines.append({
                'line': line_num,
                'column_start': col_start,
                'column_end': col_end,
                'severity': severity,
                'api': detected_api or '<model-detected>',
                'message': message,
                'code': code_snippet,
                'model_detected': True,
                'attention_score': norm_score
            })
        
        return dangerous_lines
    
    def _merge_dangerous_lines(
        self,
        model_lines: List[Dict[str, Any]],
        regex_lines: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Merge model-detected and regex-detected dangerous lines."""
        merged = {}
        
        for dl in regex_lines:
            key = (dl['line'], dl.get('api', ''))
            if key not in merged:
                merged[key] = dl.copy()
                merged[key]['model_detected'] = False
        
        for dl in model_lines:
            key = (dl['line'], dl.get('api', ''))
            if key in merged:
                existing = merged[key]
                severity_order = {'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'SAFE': 0}
                if severity_order.get(dl['severity'], 0) > severity_order.get(existing['severity'], 0):
                    existing['severity'] = dl['severity']
                existing['model_detected'] = True
                existing['attention_score'] = dl.get('attention_score', 0)
                existing['message'] = f"{existing['message']} (confirmed by model)"
            else:
                merged[key] = dl.copy()
        
        result = list(merged.values())
        result.sort(key=lambda x: (
            -{'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'SAFE': 0}.get(x['severity'], 0),
            x['line']
        ))
        
        return result
    
    def scan_file(self, file_path: str) -> Dict[str, Any]:
        """Scan a single file using HierarchicalBiGRU with attention localization."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
            
            result = self.model_wrapper.predict_with_localization(
                code,
                top_k=10,
                score_threshold=0.2,
                localize_margin=0.02
            )
            
            prediction = result.prediction
            highlights = result.highlights
            
            model_dangerous_lines = self._convert_highlights_to_dangerous_lines(
                highlights, file_path, code
            )
            
            regex_dangerous_lines = self._find_dangerous_lines_regex(file_path)
            
            merged_lines = self._merge_dangerous_lines(model_dangerous_lines, regex_dangerous_lines)
            
            dangerous_apis = list(set(
                dl.get('api', '') for dl in merged_lines 
                if dl.get('api') and dl.get('api') != '<model-detected>'
            ))
            
            return {
                "file_path": file_path,
                "vulnerable": prediction.vulnerable,
                "probability": prediction.score,
                "risk_level": self._get_risk_level(prediction.score),
                "dangerous_apis": dangerous_apis,
                "dangerous_lines": merged_lines,
                "detected_patterns": prediction.detected_patterns,
                "confidence": prediction.confidence,
                "error": None
            }
        
        except Exception as e:
            return {
                "file_path": file_path,
                "vulnerable": False,
                "probability": 0.0,
                "risk_level": "ERROR",
                "dangerous_apis": [],
                "dangerous_lines": [],
                "detected_patterns": [],
                "confidence": "low",
                "error": str(e)
            }
    
    def scan_code(self, code: str) -> Dict[str, Any]:
        """Scan code snippet for vulnerabilities."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.c', delete=False) as f:
            f.write(code)
            temp_path = f.name
        
        try:
            result = self.scan_file(temp_path)
            result["file_path"] = "code_snippet"
            return result
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class FallbackEngine(DevignEngine):
    """Simple pattern-based fallback engine when model is unavailable."""
    
    C_EXTENSIONS = {'.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'}
    
    DANGEROUS_APIS = {
        'strcpy': ('CRITICAL', 'Buffer overflow risk - use strncpy'),
        'strcat': ('CRITICAL', 'Buffer overflow risk - use strncat'),
        'sprintf': ('CRITICAL', 'Buffer overflow risk - use snprintf'),
        'gets': ('CRITICAL', 'Never use gets() - use fgets'),
        'scanf': ('HIGH', 'Buffer overflow risk with %s - use width specifier'),
        'memcpy': ('MEDIUM', 'Ensure buffer sizes are validated'),
        'malloc': ('HIGH', 'Check return value for NULL'),
        'free': ('MEDIUM', 'Ensure pointer is valid and set to NULL after'),
    }
    
    def __init__(self, threshold: float = 0.36):
        self.threshold = threshold
    
    def scan_file(self, file_path: str) -> Dict[str, Any]:
        """Scan using regex pattern matching only."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
            
            return self._analyze_code(code, file_path)
        except Exception as e:
            return {
                "file_path": file_path,
                "vulnerable": False,
                "probability": 0.0,
                "risk_level": "ERROR",
                "dangerous_apis": [],
                "dangerous_lines": [],
                "error": str(e)
            }
    
    def scan_code(self, code: str) -> Dict[str, Any]:
        """Scan code snippet."""
        return self._analyze_code(code, "code_snippet")
    
    def _analyze_code(self, code: str, file_path: str) -> Dict[str, Any]:
        """Analyze code for vulnerabilities using pattern matching."""
        dangerous_lines = []
        dangerous_apis_found = set()
        lines = code.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for api, (severity, message) in self.DANGEROUS_APIS.items():
                match = re.search(rf'\b{api}\s*\(', line)
                if match:
                    dangerous_apis_found.add(api)
                    dangerous_lines.append({
                        'line': line_num,
                        'column_start': match.start(),
                        'column_end': match.end(),
                        'severity': severity,
                        'api': api,
                        'message': f'{api}() - {message}',
                        'code': line.strip()
                    })
                    break
        
        critical_count = sum(1 for dl in dangerous_lines if dl['severity'] == 'CRITICAL')
        high_count = sum(1 for dl in dangerous_lines if dl['severity'] == 'HIGH')
        
        probability = min(1.0, critical_count * 0.3 + high_count * 0.15 + len(dangerous_lines) * 0.05)
        vulnerable = probability >= self.threshold
        
        if probability >= 0.8:
            risk_level = "CRITICAL"
        elif probability >= 0.6:
            risk_level = "HIGH"
        elif probability >= self.threshold:
            risk_level = "MEDIUM"
        elif probability >= 0.2:
            risk_level = "LOW"
        else:
            risk_level = "SAFE"
        
        return {
            "file_path": file_path,
            "vulnerable": vulnerable,
            "probability": round(probability, 4),
            "risk_level": risk_level,
            "dangerous_apis": list(dangerous_apis_found),
            "dangerous_lines": dangerous_lines,
            "error": None
        }


class VSCodeScanner:
    """Scanner wrapper for VS Code extension."""
    
    C_EXTENSIONS = {'.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'}
    
    def __init__(
        self,
        model_dir: Optional[str] = None,
        threshold: float = 0.36,
        device: str = "auto",
        auto_download: bool = True
    ):
        self.threshold = threshold
        self.device = device
        self.engine: DevignEngine
        
        model_path = None
        if model_dir:
            model_path = Path(model_dir)
        elif auto_download:
            cache_dir = get_default_cache_dir()
            model_path = download_models_from_github(cache_dir)
        
        if model_path is None:
            model_path = SCRIPT_DIR / "models"
        
        if not model_path.exists():
            model_path.mkdir(parents=True, exist_ok=True)
        
        try:
            self.engine = PipelineEngine(
                model_dir=model_path,
                threshold=threshold,
                device=device
            )
            print("Using HierarchicalBiGRU engine with attention localization", file=sys.stderr)
        except Exception as e:
            print(f"Failed to initialize PipelineEngine: {e}", file=sys.stderr)
            print("Falling back to pattern-based engine", file=sys.stderr)
            self.engine = FallbackEngine(threshold=threshold)
    
    def is_c_file(self, path: str) -> bool:
        """Check if file is a C/C++ source file."""
        return Path(path).suffix.lower() in self.C_EXTENSIONS
    
    def scan_file(self, file_path: str) -> Dict[str, Any]:
        """Scan a single file for vulnerabilities."""
        return self.engine.scan_file(file_path)
    
    def scan_code(self, code: str) -> Dict[str, Any]:
        """Scan code snippet for vulnerabilities."""
        return self.engine.scan_code(code)
    
    def scan_files(self, files: List[str]) -> List[Dict[str, Any]]:
        """Scan multiple files."""
        results = []
        for file_path in files:
            if self.is_c_file(file_path) and Path(file_path).exists():
                result = self.scan_file(file_path)
            else:
                result = {
                    "file_path": file_path,
                    "vulnerable": False,
                    "probability": 0.0,
                    "risk_level": "ERROR",
                    "dangerous_apis": [],
                    "dangerous_lines": [],
                    "error": "File not found or not a C/C++ file"
                }
            results.append(result)
        return results


def format_output(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Format results as JSON response."""
    vuln_count = sum(1 for r in results if r.get("vulnerable", False))
    error_count = sum(1 for r in results if r.get("error"))
    
    return {
        "summary": {
            "files_scanned": len(results),
            "vulnerabilities_found": vuln_count,
            "errors": error_count
        },
        "results": results
    }


def main():
    parser = argparse.ArgumentParser(description="VS Code Devign Scanner Bridge")
    
    parser.add_argument('--model-dir', type=str, default=None,
                       help='Path to model directory')
    parser.add_argument('--threshold', type=float, default=0.36,
                        help='Vulnerability threshold (optimal: 0.36)')
    parser.add_argument('--device', type=str, default='auto',
                       choices=['auto', 'cpu', 'cuda'],
                       help='Inference device')
    parser.add_argument('--no-auto-download', action='store_true',
                       help='Disable automatic model download')
    parser.add_argument('--force-download', action='store_true',
                       help='Force re-download models')
    
    subparsers = parser.add_subparsers(dest='command')
    
    scan_parser = subparsers.add_parser('scan', help='Scan file or directory')
    scan_parser.add_argument('path', type=str, help='Path to scan')
    scan_parser.add_argument('--format', type=str, default='json',
                            choices=['json', 'text'])
    
    code_parser = subparsers.add_parser('scan-code', help='Scan code snippet')
    code_parser.add_argument('--stdin', action='store_true',
                            help='Read code from stdin')
    
    batch_parser = subparsers.add_parser('scan-batch', help='Scan multiple files in batch mode')
    batch_parser.add_argument('--progress', action='store_true',
                             help='Output progress as JSON lines to stderr')
    
    download_parser = subparsers.add_parser('download', help='Download models from GitHub')
    download_parser.add_argument('--force', action='store_true',
                                help='Force re-download')
    
    info_parser = subparsers.add_parser('info', help='Show configuration info')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        if args.command == 'download':
            cache_dir = get_default_cache_dir()
            model_dir = download_models_from_github(cache_dir, force=args.force)
            if model_dir:
                print(json.dumps({
                    "success": True,
                    "model_dir": str(model_dir),
                    "message": "Models downloaded successfully"
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": "Failed to download models"
                }))
                sys.exit(1)
            return
        
        if args.command == 'info':
            cache_dir = get_default_cache_dir()
            model_dir = cache_dir / GITHUB_RELEASE_TAG
            local_model_dir = SCRIPT_DIR / "models"
            print(json.dumps({
                "cache_dir": str(cache_dir),
                "model_dir": str(model_dir),
                "local_model_dir": str(local_model_dir),
                "model_exists": model_dir.exists() or local_model_dir.exists(),
                "github_repo": GITHUB_REPO,
                "release_tag": GITHUB_RELEASE_TAG,
                "engine": "HierarchicalBiGRU" if (model_dir.exists() or local_model_dir.exists()) else "FallbackEngine"
            }, indent=2))
            return
        
        if getattr(args, 'force_download', False):
            cache_dir = get_default_cache_dir()
            download_models_from_github(cache_dir, force=True)
        
        model_dir = args.model_dir
        if not model_dir:
            local_model_dir = SCRIPT_DIR / "models"
            if local_model_dir.exists() and list(local_model_dir.glob("*.pt")):
                model_dir = str(local_model_dir)
        
        scanner = VSCodeScanner(
            model_dir=model_dir,
            threshold=args.threshold,
            device=args.device,
            auto_download=not getattr(args, 'no_auto_download', False)
        )
        
        if args.command == 'scan':
            path = Path(args.path)
            
            if path.is_file():
                results = [scanner.scan_file(str(path))]
            elif path.is_dir():
                files = []
                for ext in scanner.C_EXTENSIONS:
                    files.extend(path.rglob(f"*{ext}"))
                results = scanner.scan_files([str(f) for f in files[:100]])
            else:
                print(json.dumps({
                    "error": f"Path not found: {args.path}",
                    "summary": {"files_scanned": 0, "vulnerabilities_found": 0, "errors": 1},
                    "results": []
                }))
                sys.exit(1)
            
            output = format_output(results)
            print(json.dumps(output, indent=2))
        
        elif args.command == 'scan-code':
            if args.stdin:
                code = sys.stdin.read()
            else:
                print(json.dumps({
                    "error": "Use --stdin to provide code",
                    "summary": {"files_scanned": 0, "vulnerabilities_found": 0, "errors": 1},
                    "results": []
                }))
                sys.exit(1)
            
            result = scanner.scan_code(code)
            output = format_output([result])
            print(json.dumps(output, indent=2))
        
        elif args.command == 'scan-batch':
            input_data = sys.stdin.read()
            try:
                file_paths = json.loads(input_data)
                if not isinstance(file_paths, list):
                    raise ValueError("Expected JSON array of file paths")
            except json.JSONDecodeError as e:
                print(json.dumps({
                    "error": f"Invalid JSON input: {e}",
                    "summary": {"files_scanned": 0, "vulnerabilities_found": 0, "errors": 1},
                    "results": []
                }))
                sys.exit(1)
            
            results = []
            total = len(file_paths)
            show_progress = getattr(args, 'progress', False)
            
            for idx, file_path in enumerate(file_paths):
                if show_progress:
                    progress_msg = json.dumps({
                        "type": "progress",
                        "current": idx + 1,
                        "total": total,
                        "file": file_path
                    })
                    print(progress_msg, file=sys.stderr, flush=True)
                
                if scanner.is_c_file(file_path) and Path(file_path).exists():
                    result = scanner.scan_file(file_path)
                else:
                    result = {
                        "file_path": file_path,
                        "vulnerable": False,
                        "probability": 0.0,
                        "risk_level": "ERROR",
                        "dangerous_apis": [],
                        "dangerous_lines": [],
                        "error": "File not found or not a C/C++ file"
                    }
                results.append(result)
            
            output = format_output(results)
            print(json.dumps(output, indent=2))
    
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "summary": {"files_scanned": 0, "vulnerabilities_found": 0, "errors": 1},
            "results": []
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
