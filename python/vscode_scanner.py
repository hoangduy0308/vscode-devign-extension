#!/usr/bin/env python3
"""
VS Code Scanner Bridge for Devign Vulnerability Detection.

This script provides a simplified interface for VS Code extension
to communicate with the Devign vulnerability detector.

Supports automatic model download from GitHub Releases.
Scans code by individual functions (model was trained on function-level data).
"""

import argparse
import hashlib
import json
import re
import sys
import os
import tempfile
import urllib.request
import zipfile
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional

SCRIPT_DIR = Path(__file__).parent.resolve()

# GitHub Release configuration
GITHUB_REPO = "hoangduy0308/C-Vul-Devign"
GITHUB_RELEASE_TAG = "latest"
MODEL_FILES = ["best_v2_seed42.pt", "vocab.json", "config.json", "feature_stats.json"]
MODEL_ZIP_NAME = "devign-scanner.zip"  # Main zip with models

# TODO: Update these SHA-256 checksums with actual values from trusted source
# Generate with: python -c "import hashlib; print(hashlib.sha256(open('file','rb').read()).hexdigest())"
EXPECTED_CHECKSUMS = {
    MODEL_ZIP_NAME: "PLACEHOLDER_UPDATE_WITH_ACTUAL_SHA256_HASH_OF_DEVIGN_SCANNER_ZIP",
}


@dataclass
class FunctionInfo:
    """Information about an extracted function."""
    name: str
    code: str
    start_line: int
    end_line: int


def extract_functions_regex(code: str) -> List[FunctionInfo]:
    """Extract functions from C code using regex.
    
    The model was trained on individual functions, so we need to split
    the code into functions for accurate predictions.
    """
    functions = []
    lines = code.split('\n')
    
    # Pattern to match C function definitions
    # Matches lines like: int main(, void foo(, char* bar(, static int baz(
    func_start_pattern = re.compile(
        r'^[\s]*'  # Leading whitespace
        r'[\w\s\*]+'  # Return type with qualifiers
        r'\b(\w+)\s*\('  # Function name followed by (
    )
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Skip preprocessor, comments, empty lines
        if not stripped or stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('/*'):
            i += 1
            continue
        
        match = func_start_pattern.match(line)
        if match:
            func_name = match.group(1)
            
            # Skip keywords that look like functions
            if func_name in ('if', 'while', 'for', 'switch', 'return', 'sizeof', 'typeof', 'defined', 'else'):
                i += 1
                continue
            
            # Check if there's a '{' nearby (function definition vs declaration)
            found_brace = False
            for k in range(i, min(i + 5, len(lines))):
                if '{' in lines[k]:
                    found_brace = True
                    break
                # Stop if we hit a semicolon (it's a declaration, not definition)
                if ';' in lines[k] and '{' not in lines[k]:
                    break
            
            if not found_brace:
                i += 1
                continue
            
            start_line = i + 1  # 1-indexed
            
            # Find matching closing brace
            brace_count = 0
            func_started = False
            end_line = start_line
            
            for j in range(i, len(lines)):
                for char in lines[j]:
                    if char == '{':
                        brace_count += 1
                        func_started = True
                    elif char == '}':
                        brace_count -= 1
                
                if func_started and brace_count == 0:
                    end_line = j + 1  # 1-indexed
                    break
            
            # Extract function code
            func_code = '\n'.join(lines[i:end_line])
            functions.append(FunctionInfo(
                name=func_name,
                code=func_code,
                start_line=start_line,
                end_line=end_line
            ))
            i = end_line
        else:
            i += 1
    
    return functions


def compute_sha256(file_path: Path) -> str:
    """Compute SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()


def verify_file_integrity(file_path: Path, expected_hash: str) -> bool:
    """Verify file integrity using SHA-256 checksum.
    
    Returns True if hash matches, raises ValueError if mismatch.
    """
    actual_hash = compute_sha256(file_path)
    if actual_hash != expected_hash:
        raise ValueError(
            f"Integrity check failed for {file_path.name}!\n"
            f"Expected: {expected_hash}\n"
            f"Actual:   {actual_hash}\n"
            f"The downloaded file may be corrupted or tampered with."
        )
    return True


# Default cache directory for downloaded models
def get_default_cache_dir() -> Path:
    """Get default cache directory for models."""
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache"))
    return base / "devign-scanner" / "models"


def safe_extract(zip_file: zipfile.ZipFile, dest_dir: Path) -> None:
    """Safely extract zip file, preventing Zip Slip path traversal attacks.
    
    Validates each entry to block:
    - Absolute paths
    - Path traversal with ".."
    - Symlinks
    """
    dest_dir_str = os.path.realpath(str(dest_dir))
    
    for member in zip_file.namelist():
        member_path = os.path.realpath(os.path.join(dest_dir_str, member))
        
        if not member_path.startswith(dest_dir_str + os.sep) and member_path != dest_dir_str:
            raise ValueError(f"Attempted path traversal in zip: {member}")
        
        info = zip_file.getinfo(member)
        if info.external_attr >> 28 == 0xA:
            raise ValueError(f"Symlinks not allowed in zip: {member}")
    
    zip_file.extractall(dest_dir)


def setup_import_paths(model_dir: Path) -> None:
    """Setup Python import paths for devign modules.
    
    Only uses modules from the downloaded zip to ensure consistent behavior
    across different machines.
    """
    # Add model_dir to path (contains devign_infer, src folders from zip)
    # Insert at position 0 to prioritize downloaded modules over any local installations
    if str(model_dir) not in sys.path:
        sys.path.insert(0, str(model_dir))


def download_file(url: str, dest: Path, show_progress: bool = True) -> bool:
    """Download a file from URL to destination."""
    try:
        if show_progress:
            print(f"Downloading {url}...", file=sys.stderr)
        
        # Create request with headers to handle GitHub redirects
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
    
    # Check if already downloaded
    if not force and model_dir.exists():
        required_files = ["vocab.json", "config.json"]
        pt_files = list(model_dir.glob("*.pt"))
        if all((model_dir / f).exists() for f in required_files) and pt_files:
            print(f"Models already exist at {model_dir}", file=sys.stderr)
            return model_dir
    
    model_dir.mkdir(parents=True, exist_ok=True)
    
    base_url = f"https://github.com/{GITHUB_REPO}/releases/download/{GITHUB_RELEASE_TAG}"
    
    # Try downloading the zip file directly (most reliable)
    print(f"Downloading models from GitHub Release {GITHUB_RELEASE_TAG}...", file=sys.stderr)
    zip_url = f"{base_url}/{MODEL_ZIP_NAME}"
    zip_path = model_dir / MODEL_ZIP_NAME
    
    if download_file(zip_url, zip_path):
        try:
            # Verify integrity before extraction
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
            
            # Check if contents are in a subdirectory (e.g., devign-scanner/)
            # and move everything to model_dir
            for subdir in list(model_dir.iterdir()):
                if subdir.is_dir() and subdir.name not in ['devign_infer', 'config', 'models']:
                    # This is likely the root folder from zip (e.g., devign-scanner/)
                    print(f"Moving contents from {subdir.name}/ to model_dir...", file=sys.stderr)
                    
                    # Move all contents from subdir to model_dir
                    for item in subdir.iterdir():
                        dest = model_dir / item.name
                        if not dest.exists():
                            shutil.move(str(item), str(dest))
                        elif item.is_dir():
                            # Merge directories
                            for sub_item in item.iterdir():
                                sub_dest = dest / sub_item.name
                                if not sub_dest.exists():
                                    shutil.move(str(sub_item), str(sub_dest))
                    
                    # Remove empty subdir
                    try:
                        shutil.rmtree(str(subdir))
                    except:
                        pass
            
            # If models are in a nested 'models' folder, keep them there
            # The _find_model_file method will look in models/ subdirectory
            
            print("Models extracted successfully!", file=sys.stderr)
            
            # Debug: list contents after extraction
            print(f"Contents of {model_dir}:", file=sys.stderr)
            for item in model_dir.iterdir():
                print(f"  - {item.name} ({'dir' if item.is_dir() else 'file'})", file=sys.stderr)
                
        except Exception as e:
            print(f"Failed to extract {MODEL_ZIP_NAME}: {e}", file=sys.stderr)
            return None
    else:
        print(f"Failed to download {MODEL_ZIP_NAME}", file=sys.stderr)
        return None
    
    # Verify required files exist
    # Check for .pt files and vocab.json in models/ subdirectory or root
    models_subdir = model_dir / "models"
    if models_subdir.exists():
        pt_files = list(models_subdir.glob("*.pt"))
        print(f"Found {len(pt_files)} .pt files in models/", file=sys.stderr)
        vocab_path = models_subdir / "vocab.json"
    else:
        pt_files = list(model_dir.glob("*.pt"))
        print(f"Found {len(pt_files)} .pt files in root", file=sys.stderr)
        vocab_path = model_dir / "vocab.json"
    
    vocab_exists = vocab_path.exists()
    print(f"vocab.json exists at {vocab_path}: {vocab_exists}", file=sys.stderr)
    
    if vocab_exists and pt_files:
        return model_dir
    
    print(f"Verification failed - vocab: {vocab_exists}, pt_files: {len(pt_files)}", file=sys.stderr)
    return None


def import_devign_modules(model_dir: Optional[Path] = None):
    """Import devign modules after setting up paths.
    
    Only uses modules from the downloaded model_dir to ensure consistent
    inference results across different machines.
    """
    global DEVIGN_AVAILABLE, IMPORT_ERROR, ModelWrapper, InferenceConfig, get_model_wrapper
    
    # Setup paths if model_dir provided
    if model_dir:
        setup_import_paths(model_dir)
        print(f"Import paths set up for: {model_dir}", file=sys.stderr)
        
        # List contents of model_dir for debugging
        try:
            contents = list(model_dir.iterdir())
            print(f"Model dir contents: {[c.name for c in contents]}", file=sys.stderr)
        except Exception as e:
            print(f"Could not list model dir: {e}", file=sys.stderr)
    
    try:
        from devign_infer import ModelWrapper, InferenceConfig, get_model_wrapper
        from devign_infer.config import find_model_path, find_vocab_path
        DEVIGN_AVAILABLE = True
        print("Successfully imported devign_infer modules", file=sys.stderr)
        return True
    except ImportError as e:
        DEVIGN_AVAILABLE = False
        IMPORT_ERROR = str(e)
        print(f"Failed to import devign_infer: {e}", file=sys.stderr)
        print(f"sys.path: {sys.path[:5]}...", file=sys.stderr)
        return False


# Try initial import (might fail if modules not downloaded yet)
DEVIGN_AVAILABLE = False
IMPORT_ERROR = "Not initialized"
ModelWrapper = None
InferenceConfig = None
get_model_wrapper = None


class VSCodeScanner:
    """Scanner wrapper for VS Code extension."""
    
    C_EXTENSIONS = {'.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'}
    
    def __init__(
        self,
        model_dir: Optional[str] = None,
        threshold: float = 0.65,
        device: str = "auto",
        auto_download: bool = True
    ):
        self.threshold = threshold
        self.device = device
        
        # Determine model directory
        if model_dir:
            model_path = Path(model_dir)
        else:
            # Try to auto-download from GitHub
            if auto_download:
                cache_dir = get_default_cache_dir()
                model_path = download_models_from_github(cache_dir)
                if not model_path:
                    raise FileNotFoundError(
                        f"Failed to download models from GitHub. "
                        f"Please download manually from: "
                        f"https://github.com/{GITHUB_REPO}/releases/tag/{GITHUB_RELEASE_TAG}"
                    )
            else:
                raise FileNotFoundError("No model directory specified and auto-download disabled")
        
        # Import modules after we have model_path (which contains devign_infer)
        if not import_devign_modules(model_path):
            raise ImportError(f"Devign modules not available: {IMPORT_ERROR}")
        
        self.model_file = self._find_model_file(model_path)
        self.vocab_file = self._find_vocab_file(model_path)
        self.config_file = self._find_config_file(model_path)
        
        if not self.model_file:
            raise FileNotFoundError(f"No model .pt file found in {model_path}")
        if not self.vocab_file.exists():
            raise FileNotFoundError(f"vocab.json not found in {model_path}")
        
        # Use get_model_wrapper to create the detector (singleton)
        self.detector = get_model_wrapper()
    
    def _find_model_file(self, model_dir: Path) -> Optional[Path]:
        """Find the best model file in directory or models/ subdirectory."""
        if model_dir.is_file() and model_dir.suffix == '.pt':
            return model_dir
        
        # First check in models/ subdirectory
        models_subdir = model_dir / "models"
        if models_subdir.exists():
            pt_files = list(models_subdir.glob("*.pt"))
        else:
            pt_files = list(model_dir.glob("*.pt"))
        
        if not pt_files:
            # Fallback: search in root if models/ was empty
            pt_files = list(model_dir.glob("*.pt"))
        
        if not pt_files:
            return None
        
        # Prefer specific patterns
        for pattern in ['best_v2_seed42', 'best_', 'model']:
            for f in pt_files:
                if pattern in f.name:
                    return f
        
        return pt_files[0]
    
    def _find_vocab_file(self, model_dir: Path) -> Path:
        """Find vocab.json in directory or models/ subdirectory."""
        # First check in models/ subdirectory
        models_subdir = model_dir / "models"
        if models_subdir.exists():
            vocab_path = models_subdir / "vocab.json"
            if vocab_path.exists():
                return vocab_path
        
        # Fallback to root
        return model_dir / "vocab.json"
    
    def _find_config_file(self, model_dir: Path) -> Path:
        """Find config.json in directory or models/ subdirectory."""
        # First check in models/ subdirectory
        models_subdir = model_dir / "models"
        if models_subdir.exists():
            config_path = models_subdir / "config.json"
            if config_path.exists():
                return config_path
        
        # Fallback to root
        return model_dir / "config.json"
    
    def is_c_file(self, path: str) -> bool:
        """Check if file is a C/C++ source file."""
        return Path(path).suffix.lower() in self.C_EXTENSIONS
    
    def scan_file(self, file_path: str, by_functions: bool = True) -> Dict[str, Any]:
        """Scan a single file for vulnerabilities.
        
        Args:
            file_path: Path to the C/C++ source file
            by_functions: If True, scan each function individually (recommended)
        """
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
            
            # Extract functions from the file
            functions = extract_functions_regex(code)
            
            if not functions:
                # No functions found, scan the whole file
                return self._scan_whole_file(file_path, code)
            
            # Scan each function individually
            function_results = []
            file_vulnerable = False
            max_probability = 0.0
            all_patterns = []
            
            for func in functions:
                result = self.detector.predict(func.code)
                risk_level = self._get_risk_level(result.score)
                
                func_result = {
                    "function_name": func.name,
                    "start_line": func.start_line,
                    "end_line": func.end_line,
                    "vulnerable": result.vulnerable,
                    "probability": result.score,
                    "risk_level": risk_level,
                    "confidence": result.confidence,
                    "detected_patterns": result.detected_patterns if hasattr(result, 'detected_patterns') else []
                }
                
                if result.vulnerable:
                    file_vulnerable = True
                    function_results.append(func_result)
                    all_patterns.extend(func_result["detected_patterns"])
                
                if result.score > max_probability:
                    max_probability = result.score
            
            # Determine overall file risk level
            overall_risk = self._get_risk_level(max_probability) if file_vulnerable else "SAFE"
            
            return {
                "file_path": file_path,
                "analysis_mode": "function_level",
                "vulnerable": file_vulnerable,
                "probability": max_probability,
                "risk_level": overall_risk,
                "dangerous_apis": list(set(all_patterns)),
                "dangerous_lines": [],
                "function_results": function_results,
                "summary": {
                    "functions_scanned": len(functions),
                    "vulnerable_functions": len(function_results),
                    "threshold": self.threshold
                },
                "error": None
            }
        except Exception as e:
            return {
                "file_path": file_path,
                "analysis_mode": "error",
                "vulnerable": False,
                "probability": 0.0,
                "risk_level": "ERROR",
                "dangerous_apis": [],
                "dangerous_lines": [],
                "function_results": [],
                "summary": {},
                "error": str(e)
            }
    
    def _scan_whole_file(self, file_path: str, code: str) -> Dict[str, Any]:
        """Scan the whole file when no functions are found."""
        try:
            result = self.detector.predict(code)
            risk_level = self._get_risk_level(result.score)
            
            return {
                "file_path": file_path,
                "analysis_mode": "file_level",
                "vulnerable": result.vulnerable,
                "probability": result.score,
                "risk_level": risk_level,
                "dangerous_apis": result.detected_patterns if hasattr(result, 'detected_patterns') else [],
                "dangerous_lines": [],
                "function_results": [],
                "summary": {
                    "confidence": result.confidence,
                    "threshold": result.threshold
                },
                "error": None
            }
        except Exception as e:
            return {
                "file_path": file_path,
                "analysis_mode": "error",
                "vulnerable": False,
                "probability": 0.0,
                "risk_level": "ERROR",
                "dangerous_apis": [],
                "dangerous_lines": [],
                "function_results": [],
                "summary": {},
                "error": str(e)
            }
    
    def _get_risk_level(self, score: float) -> str:
        """Convert probability score to risk level.
        
        Based on threshold of 0.65:
        - CRITICAL: >= 90% (very high confidence)
        - HIGH: >= 75% (high confidence, above threshold)
        - MEDIUM: >= 65% (at threshold)
        - LOW: >= 50% (below threshold but notable)
        - SAFE: < 50%
        """
        if score >= 0.9:
            return "CRITICAL"
        elif score >= 0.75:
            return "HIGH"
        elif score >= 0.65:
            return "MEDIUM"
        elif score >= 0.5:
            return "LOW"
        else:
            return "SAFE"
    
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
    
    def scan_files(self, files: List[str]) -> List[Dict[str, Any]]:
        """Scan multiple files."""
        results = []
        for file_path in files:
            if self.is_c_file(file_path):
                result = self.scan_file(file_path)
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
                       help='Path to model directory (auto-downloads from GitHub if not specified)')
    parser.add_argument('--threshold', type=float, default=0.65,
                        help='Vulnerability threshold (optimal: 0.65)')
    parser.add_argument('--device', type=str, default='auto',
                       choices=['auto', 'cpu', 'cuda'],
                       help='Inference device')
    parser.add_argument('--no-auto-download', action='store_true',
                       help='Disable automatic model download from GitHub')
    parser.add_argument('--force-download', action='store_true',
                       help='Force re-download models from GitHub')
    
    subparsers = parser.add_subparsers(dest='command')
    
    # Scan command
    scan_parser = subparsers.add_parser('scan', help='Scan file or directory')
    scan_parser.add_argument('path', type=str, help='Path to scan')
    scan_parser.add_argument('--format', type=str, default='json',
                            choices=['json', 'text'])
    
    # Scan code command
    code_parser = subparsers.add_parser('scan-code', help='Scan code snippet')
    code_parser.add_argument('--stdin', action='store_true',
                            help='Read code from stdin')
    
    # Batch scan command - reads JSON array of file paths from stdin
    batch_parser = subparsers.add_parser('scan-batch', help='Scan multiple files in batch mode')
    batch_parser.add_argument('--progress', action='store_true',
                             help='Output progress as JSON lines to stderr')
    
    # Download command
    download_parser = subparsers.add_parser('download', help='Download models from GitHub')
    download_parser.add_argument('--force', action='store_true',
                                help='Force re-download')
    
    # Info command
    info_parser = subparsers.add_parser('info', help='Show configuration info')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        # Handle download command separately
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
        
        # Handle info command
        if args.command == 'info':
            cache_dir = get_default_cache_dir()
            model_dir = cache_dir / GITHUB_RELEASE_TAG
            print(json.dumps({
                "cache_dir": str(cache_dir),
                "model_dir": str(model_dir),
                "model_exists": model_dir.exists(),
                "github_repo": GITHUB_REPO,
                "release_tag": GITHUB_RELEASE_TAG,
                "devign_available": DEVIGN_AVAILABLE
            }, indent=2))
            return
        
        # Force download if requested
        if getattr(args, 'force_download', False):
            cache_dir = get_default_cache_dir()
            download_models_from_github(cache_dir, force=True)
        
        scanner = VSCodeScanner(
            model_dir=args.model_dir,
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
