#!/usr/bin/env python3
"""
C Vulnerability Scanner - BiGRU Model
Scan C source files for potential security vulnerabilities
"""

import argparse
import json
import sys
import os
import subprocess
from pathlib import Path


def print_banner():
    print("=" * 60)
    print("  C Vulnerability Scanner v2.0")
    print("  BiGRU + Slice Attention Model")
    print("=" * 60)
    print()


def scan_file(filepath: str, show_highlights: bool = True) -> dict:
    """Scan a single C file for vulnerabilities"""
    # Get the parent directory (C-Vul-Devign)
    scanner_dir = Path(__file__).parent
    project_dir = scanner_dir.parent
    
    # Run the analyze_file CLI
    cmd = [
        sys.executable, "-m", "devign_pipeline.cli.analyze_file",
        "--file", filepath,
        "--json"
    ]
    
    try:
        result = subprocess.run(
            cmd,
            cwd=str(project_dir),
            capture_output=True,
            text=True
        )
        
        # Parse JSON output
        output = result.stdout.strip()
        if output:
            return json.loads(output)
        else:
            return {
                "file": filepath,
                "vulnerable": False,
                "score": 0,
                "error": result.stderr
            }
    except Exception as e:
        return {
            "file": filepath,
            "vulnerable": False,
            "score": 0,
            "error": str(e)
        }


def scan_directory(dirpath: str, recursive: bool = True) -> list:
    """Scan all C files in a directory"""
    results = []
    path = Path(dirpath)
    
    pattern = "**/*.c" if recursive else "*.c"
    for filepath in path.glob(pattern):
        result = scan_file(str(filepath))
        results.append(result)
    
    # Also scan header files
    pattern = "**/*.h" if recursive else "*.h"
    for filepath in path.glob(pattern):
        result = scan_file(str(filepath))
        results.append(result)
    
    return results


def print_result(result: dict, verbose: bool = False):
    """Print scan result in a formatted way"""
    file = result.get("file", "unknown")
    vulnerable = result.get("vulnerable", False)
    score = result.get("score", 0)
    confidence = result.get("confidence", "unknown")
    
    if vulnerable:
        status = "❌ VULNERABLE"
    else:
        status = "✅ SAFE"
    
    print(f"{status} | {file}")
    print(f"   Score: {score:.4f} | Confidence: {confidence}")
    
    if verbose and vulnerable and "highlights" in result:
        print("   Potential issues:")
        for h in result["highlights"][:5]:
            line = h.get("line", "?")
            snippet = h.get("code_snippet", "")[:60]
            risk = h.get("normalized_score", 0)
            print(f"     Line {line} (risk: {risk:.0%}): {snippet}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Scan C source files for security vulnerabilities"
    )
    parser.add_argument(
        "path",
        help="File or directory to scan"
    )
    parser.add_argument(
        "-r", "--recursive",
        action="store_true",
        help="Scan directories recursively"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed vulnerability information"
    )
    parser.add_argument(
        "-j", "--json",
        action="store_true",
        help="Output results as JSON"
    )
    parser.add_argument(
        "--fail-on-vuln",
        action="store_true",
        help="Exit with code 1 if vulnerabilities found"
    )
    
    args = parser.parse_args()
    
    if not args.json:
        print_banner()
    
    path = Path(args.path)
    
    if not path.exists():
        print(f"Error: {args.path} not found", file=sys.stderr)
        sys.exit(1)
    
    results = []
    
    if path.is_file():
        results = [scan_file(str(path))]
    else:
        results = scan_directory(str(path), args.recursive)
    
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        vuln_count = 0
        safe_count = 0
        
        for result in results:
            print_result(result, args.verbose)
            if result.get("vulnerable"):
                vuln_count += 1
            else:
                safe_count += 1
        
        print("=" * 60)
        print(f"SUMMARY: {len(results)} files scanned")
        print(f"  ✅ Safe: {safe_count}")
        print(f"  ❌ Vulnerable: {vuln_count}")
        print("=" * 60)
    
    if args.fail_on_vuln and any(r.get("vulnerable") for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
