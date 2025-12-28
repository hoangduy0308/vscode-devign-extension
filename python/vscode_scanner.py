#!/usr/bin/env python3
"""
VS Code Scanner Bridge for Devign Vulnerability Detection.

This script provides a simplified interface for VS Code extension
to communicate with the Devign vulnerability detector.

Supports automatic model download from GitHub Releases.
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
            
            # Check if models are in a subdirectory
            for subdir in model_dir.iterdir():
                if subdir.is_dir():
                    # Move files from subdirectory to model_dir
                    for f in subdir.glob("*.pt"):
                        shutil.move(str(f), str(model_dir / f.name))
                    for f in subdir.glob("*.json"):
                        if not (model_dir / f.name).exists():
                            shutil.move(str(f), str(model_dir / f.name))
                    # Check nested models directory
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
    
    # Verify required files exist
    pt_files = list(model_dir.glob("*.pt"))
    if (model_dir / "vocab.json").exists() and pt_files:
        return model_dir
    
    return None


def import_devign_modules(model_dir: Optional[Path] = None):
    """Import devign modules after setting up paths.
    
    Only uses modules from the downloaded model_dir to ensure consistent
    inference results across different machines.
    """
    global DEVIGN_AVAILABLE, IMPORT_ERROR, VulnerabilityDetector, InferenceConfig
    
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
        from devign_infer import VulnerabilityDetector, InferenceConfig
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
VulnerabilityDetector = None
InferenceConfig = None


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
        self.vocab_file = model_path / "vocab.json"
        self.config_file = model_path / "config.json"
        
        if not self.model_file:
            raise FileNotFoundError(f"No model .pt file found in {model_path}")
        if not self.vocab_file.exists():
            raise FileNotFoundError(f"vocab.json not found in {model_path}")
        
        self.detector = VulnerabilityDetector(
            model_path=str(self.model_file),
            vocab_path=str(self.vocab_file),
            config_path=str(self.config_file) if self.config_file.exists() else None,
            device=device,
            threshold=threshold
        )
    
    def _find_model_file(self, model_dir: Path) -> Optional[Path]:
        """Find the best model file in directory."""
        if model_dir.is_file() and model_dir.suffix == '.pt':
            return model_dir
        
        pt_files = list(model_dir.glob("*.pt"))
        
        if not pt_files:
            return None
        
        # Prefer specific patterns
        for pattern in ['best_v2_seed42', 'best_', 'model']:
            for f in pt_files:
                if pattern in f.name:
                    return f
        
        return pt_files[0]
    
    def is_c_file(self, path: str) -> bool:
        """Check if file is a C/C++ source file."""
        return Path(path).suffix.lower() in self.C_EXTENSIONS
    
    def scan_file(self, file_path: str, by_functions: bool = True) -> Dict[str, Any]:
        """Scan a single file for vulnerabilities.
        
        Args:
            file_path: Path to the C/C++ source file
            by_functions: If True, analyze each function separately (more accurate)
        """
        try:
            if by_functions:
                # Use function-level analysis for more accurate results
                result = self.detector.analyze_file_by_functions(file_path)
                
                # Find line numbers of dangerous APIs
                dangerous_lines = self._find_dangerous_lines(file_path)
                
                # Map dangerous_lines to functions
                for dl in dangerous_lines:
                    for func in result.get("function_results", []):
                        if func["start_line"] <= dl["line"] <= func["end_line"]:
                            dl["function"] = func["function_name"]
                            # Use function's risk level if higher
                            if func["vulnerable"]:
                                dl["model_detected"] = True
                            break
                
                return {
                    "file_path": file_path,
                    "analysis_mode": result.get("analysis_mode", "function_level"),
                    "vulnerable": result["summary"]["overall_vulnerable"],
                    "probability": result["summary"]["max_probability"],
                    "risk_level": result["summary"]["overall_risk_level"],
                    "dangerous_apis": self._collect_dangerous_apis(result),
                    "dangerous_lines": dangerous_lines,
                    "function_results": result.get("function_results", []),
                    "summary": result["summary"],
                    "error": None
                }
            else:
                # Legacy file-level analysis
                result = self.detector.analyze_file(file_path)
                dangerous_lines = self._find_dangerous_lines(file_path)
                
                return {
                    "file_path": file_path,
                    "analysis_mode": "file_level",
                    "vulnerable": result.vulnerable,
                    "probability": result.probability,
                    "risk_level": result.risk_level,
                    "dangerous_apis": result.details.get("dangerous_apis_found", []),
                    "dangerous_lines": dangerous_lines,
                    "function_results": [],
                    "summary": {},
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
    
    def _collect_dangerous_apis(self, result: Dict[str, Any]) -> List[str]:
        """Collect all dangerous APIs from function results."""
        apis = set()
        for func in result.get("function_results", []):
            apis.update(func.get("dangerous_apis", []))
        return list(apis)
    
    def _find_dangerous_lines(self, file_path: str) -> List[Dict[str, Any]]:
        """Find line numbers containing dangerous APIs and patterns.
        
        Skips comments (single-line // and multi-line /* */) to avoid false positives.
        """
        dangerous_lines = []
        
        # Dangerous APIs that often cause vulnerabilities
        dangerous_apis = [
            'strcpy', 'strcat', 'sprintf', 'vsprintf', 'gets', 'scanf',
            'sscanf', 'fscanf', 'memcpy', 'memmove', 'strncpy', 'strncat',
            'malloc', 'calloc', 'realloc', 'free', 'alloca'
        ]
        
        # Patterns for potential vulnerabilities
        patterns = [
            (r'\b(strcpy|strcat|sprintf|gets)\s*\(', 'CRITICAL', 'Buffer overflow risk - use safe alternatives'),
            (r'\bmalloc\s*\([^)]+\)\s*;(?!.*if)', 'HIGH', 'Unchecked malloc return value'),
            (r'\*\s*\w+\s*=', 'MEDIUM', 'Potential null pointer dereference'),
            (r'\[\s*\w+\s*\]', 'LOW', 'Array access - ensure bounds checking'),
            (r'\bfree\s*\(\s*\w+\s*\)', 'MEDIUM', 'Free without null check'),
            (r'\b(memcpy|memmove)\s*\(', 'MEDIUM', 'Memory copy - verify buffer sizes'),
        ]
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            import re
            
            in_multiline_comment = False
            
            for line_num, line in enumerate(lines, 1):
                # Track multi-line comment state
                # Handle /* */ comments that may span multiple lines
                temp_line = line
                code_part = ""
                
                i = 0
                while i < len(temp_line):
                    if in_multiline_comment:
                        # Look for end of multi-line comment
                        end_idx = temp_line.find('*/', i)
                        if end_idx != -1:
                            in_multiline_comment = False
                            i = end_idx + 2
                        else:
                            # Rest of line is comment
                            break
                    else:
                        # Look for start of comments
                        single_comment = temp_line.find('//', i)
                        multi_comment = temp_line.find('/*', i)
                        
                        if single_comment != -1 and (multi_comment == -1 or single_comment < multi_comment):
                            # Single-line comment - rest of line is comment
                            code_part += temp_line[i:single_comment]
                            break
                        elif multi_comment != -1:
                            # Multi-line comment starts
                            code_part += temp_line[i:multi_comment]
                            end_idx = temp_line.find('*/', multi_comment + 2)
                            if end_idx != -1:
                                # Comment ends on same line
                                i = end_idx + 2
                            else:
                                # Comment continues to next line
                                in_multiline_comment = True
                                break
                        else:
                            # No comments found, rest is code
                            code_part += temp_line[i:]
                            break
                
                # Skip if no actual code (entire line is comment)
                if not code_part.strip():
                    continue
                
                # Check for dangerous API calls in code part only
                for api in dangerous_apis:
                    match = re.search(rf'\b{api}\s*\(', code_part)
                    if match:
                        # Determine severity based on API
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
                        
                        # Find column position in original line
                        orig_match = re.search(rf'\b{api}\s*\(', line)
                        col_start = orig_match.start() if orig_match else 0
                        col_end = orig_match.end() if orig_match else len(line)
                        
                        dangerous_lines.append({
                            'line': line_num,
                            'column_start': col_start,
                            'column_end': col_end,
                            'severity': severity,
                            'api': api,
                            'message': message,
                            'code': line.strip()
                        })
                        break  # One finding per line
                        
        except Exception as e:
            pass  # Silently fail if file can't be read
        
        return dangerous_lines
    
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
