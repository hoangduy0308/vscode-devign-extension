# C Vulnerability Scanner

A BiGRU-based vulnerability detection tool for C source code.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Scan a single file
```bash
python scanner.py path/to/file.c
```

### Scan a directory
```bash
python scanner.py path/to/directory -r
```

### Options
- `-r, --recursive` : Scan directories recursively
- `-v, --verbose` : Show detailed vulnerability information
- `-j, --json` : Output results as JSON
- `--fail-on-vuln` : Exit with code 1 if vulnerabilities found (for CI/CD)

### Examples

```bash
# Scan a file with verbose output
python scanner.py mycode.c -v

# Scan directory and output JSON
python scanner.py src/ -r -j > results.json

# Use in CI/CD (fail if vulnerable)
python scanner.py src/ -r --fail-on-vuln
```

## Model Information

- **Architecture**: BiGRU + Slice Attention
- **Dataset**: Devign
- **Threshold**: 0.65
- **Ensemble**: 3 models (seed 42, 1042, 2042)

## Output

```
✅ SAFE | mycode.c
   Score: 0.5147 | Confidence: low

❌ VULNERABLE | unsafe.c
   Score: 0.9470 | Confidence: high
   Potential issues:
     Line 24 (risk: 100%): return ptr;  // Use after free
     Line 13 (risk: 64%): printf(buffer);
```
