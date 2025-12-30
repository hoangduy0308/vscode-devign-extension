#!/usr/bin/env python3
"""
Devign Vulnerability Scanner - Command Line Interface

Usage:
    devign scan path/to/file.c
    devign scan path/to/dir --recursive
    devign convert results.json --output results.sarif
    devign version
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from devign import __version__


def get_scanner():
    """Lazy import and create scanner instance."""
    try:
        from onnx_inference import ONNXModelWrapper, get_onnx_model_wrapper
        return get_onnx_model_wrapper()
    except ImportError:
        try:
            from vscode_scanner import VSCodeScanner
            return VSCodeScanner()
        except ImportError as e:
            print(json.dumps({"error": f"Scanner not available: {e}"}), file=sys.stderr)
            sys.exit(1)


def scan_file(scanner, file_path: Path) -> Dict[str, Any]:
    """Scan a single file for vulnerabilities."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            code = f.read()
        
        result = scanner.predict(code)
        
        return {
            "file": str(file_path),
            "vulnerable": result.vulnerable,
            "score": result.score,
            "threshold": result.threshold,
            "confidence": result.confidence,
            "detected_patterns": result.detected_patterns,
            "latency_ms": getattr(result, 'latency_ms', 0),
            "error": None
        }
    except Exception as e:
        return {
            "file": str(file_path),
            "vulnerable": False,
            "score": 0.0,
            "threshold": 0.65,
            "confidence": "error",
            "detected_patterns": [],
            "latency_ms": 0,
            "error": str(e)
        }


def cmd_scan(args) -> int:
    """Handle scan command."""
    path = Path(args.path)
    
    if not path.exists():
        print(json.dumps({"error": f"Path not found: {args.path}"}))
        return 1
    
    scanner = get_scanner()
    c_extensions = {'.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx'}
    
    files_to_scan: List[Path] = []
    
    if path.is_file():
        files_to_scan.append(path)
    elif path.is_dir():
        if args.recursive:
            for ext in c_extensions:
                files_to_scan.extend(path.rglob(f"*{ext}"))
        else:
            for ext in c_extensions:
                files_to_scan.extend(path.glob(f"*{ext}"))
    
    results = []
    for file_path in files_to_scan:
        if file_path.suffix.lower() in c_extensions:
            result = scan_file(scanner, file_path)
            results.append(result)
    
    vuln_count = sum(1 for r in results if r.get("vulnerable", False))
    error_count = sum(1 for r in results if r.get("error"))
    
    output = {
        "summary": {
            "files_scanned": len(results),
            "vulnerabilities_found": vuln_count,
            "errors": error_count
        },
        "results": results
    }
    
    print(json.dumps(output, indent=2 if args.pretty else None))
    return 0


def cmd_convert(args) -> int:
    """Handle convert command - convert results to SARIF format."""
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {args.input}"}))
        return 1
    
    try:
        with open(input_path, 'r') as f:
            scan_results = json.load(f)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        return 1
    
    sarif = convert_to_sarif(scan_results)
    
    if args.output:
        output_path = Path(args.output)
        with open(output_path, 'w') as f:
            json.dump(sarif, f, indent=2)
        print(json.dumps({"success": True, "output": str(output_path)}))
    else:
        print(json.dumps(sarif, indent=2))
    
    return 0


def convert_to_sarif(scan_results: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Devign scan results to SARIF format."""
    results_list = scan_results.get("results", [])
    
    sarif_results = []
    for result in results_list:
        if result.get("vulnerable", False):
            sarif_result = {
                "ruleId": "devign/vulnerability-detected",
                "level": get_sarif_level(result.get("score", 0)),
                "message": {
                    "text": f"Potential vulnerability detected with {result.get('score', 0):.1%} confidence"
                },
                "locations": [{
                    "physicalLocation": {
                        "artifactLocation": {
                            "uri": result.get("file", "unknown")
                        },
                        "region": {
                            "startLine": 1
                        }
                    }
                }],
                "properties": {
                    "score": result.get("score", 0),
                    "confidence": result.get("confidence", "unknown"),
                    "detected_patterns": result.get("detected_patterns", [])
                }
            }
            sarif_results.append(sarif_result)
    
    sarif = {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {
                "driver": {
                    "name": "Devign Vulnerability Scanner",
                    "version": __version__,
                    "informationUri": "https://github.com/hoangduy0308/vscode-devign-extension",
                    "rules": [{
                        "id": "devign/vulnerability-detected",
                        "name": "VulnerabilityDetected",
                        "shortDescription": {
                            "text": "Potential vulnerability detected by Devign ML model"
                        },
                        "fullDescription": {
                            "text": "The Devign deep learning model has detected patterns in this code that are associated with security vulnerabilities."
                        },
                        "defaultConfiguration": {
                            "level": "warning"
                        }
                    }]
                }
            },
            "results": sarif_results
        }]
    }
    
    return sarif


def get_sarif_level(score: float) -> str:
    """Convert vulnerability score to SARIF level."""
    if score >= 0.9:
        return "error"
    elif score >= 0.75:
        return "warning"
    else:
        return "note"


def cmd_version(args) -> int:
    """Handle version command."""
    output = {
        "name": "devign-scanner",
        "version": __version__,
        "python": sys.version
    }
    print(json.dumps(output, indent=2 if getattr(args, 'pretty', False) else None))
    return 0


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="devign",
        description="Devign Vulnerability Scanner - Detect vulnerabilities in C/C++ code"
    )
    parser.add_argument(
        '--pretty', '-p',
        action='store_true',
        help='Pretty-print JSON output'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # scan command
    scan_parser = subparsers.add_parser('scan', help='Scan files/directories for vulnerabilities')
    scan_parser.add_argument('path', type=str, help='File or directory to scan')
    scan_parser.add_argument(
        '--recursive', '-r',
        action='store_true',
        help='Recursively scan directories'
    )
    scan_parser.add_argument(
        '--threshold', '-t',
        type=float,
        default=0.65,
        help='Vulnerability threshold (default: 0.65)'
    )
    scan_parser.set_defaults(func=cmd_scan)
    
    # convert command
    convert_parser = subparsers.add_parser('convert', help='Convert scan results to SARIF format')
    convert_parser.add_argument('input', type=str, help='Input JSON file with scan results')
    convert_parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help='Output SARIF file (prints to stdout if not specified)'
    )
    convert_parser.set_defaults(func=cmd_convert)
    
    # version command
    version_parser = subparsers.add_parser('version', help='Show version information')
    version_parser.set_defaults(func=cmd_version)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 0
    
    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
