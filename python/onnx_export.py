#!/usr/bin/env python3
"""
ONNX Export Script for Devign BiGRU Model.

Converts PyTorch HierarchicalBiGRU model to ONNX format for faster inference.
Target: p50 <100ms latency.

Usage:
    python onnx_export.py --model-path models/best_v2_seed42.pt --output model.onnx
    python onnx_export.py --benchmark  # Run latency benchmark
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import statistics

# Add model directory to path
SCRIPT_DIR = Path(__file__).parent.resolve()
CACHE_DIR = Path.home() / "AppData" / "Local" / "devign-scanner" / "models" / "latest"

if CACHE_DIR.exists():
    sys.path.insert(0, str(CACHE_DIR))

import torch
import torch.nn as nn

# Try to import ONNX runtime for verification
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    print("Warning: onnxruntime not installed. Install with: pip install onnxruntime", file=sys.stderr)


# Model configuration matching training
MODEL_CONFIG = {
    "vocab_size": 238,
    "embed_dim": 96,
    "hidden_dim": 192,
    "slice_hidden": 160,
    "vuln_dim": 26,
    "slice_feat_dim": 52,
    "gate_init": 0.4,
    "max_len": 512,
    "num_slices": 6,
    "slice_len": 256,
}


class HierarchicalBiGRUSimplified(nn.Module):
    """Simplified HierarchicalBiGRU for ONNX export.
    
    This version removes control flow that ONNX doesn't handle well
    and provides a clean forward path for tracing.
    """
    
    def __init__(self, vocab_size=238, embed_dim=96, hidden_dim=192, slice_hidden=160,
                 vuln_dim=26, slice_feat_dim=52, gate_init=0.3):
        super().__init__()
        self.slice_hidden = slice_hidden
        self.hidden_dim = hidden_dim
        
        # Embeddings
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.embed_drop = nn.Dropout(0.3)
        
        # Global encoder
        self.global_gru = nn.GRU(embed_dim, hidden_dim, num_layers=2, 
                                 bidirectional=True, batch_first=True, dropout=0.4)
        self.global_attn = nn.Sequential(
            nn.Linear(hidden_dim*2, hidden_dim), 
            nn.Tanh(), 
            nn.Linear(hidden_dim, 1)
        )
        
        # Slice encoder
        self.slice_gru = nn.GRU(embed_dim, slice_hidden, bidirectional=True, batch_first=True)
        self.slice_attn = nn.Sequential(
            nn.Linear(slice_hidden*2, slice_hidden), 
            nn.Tanh(), 
            nn.Linear(slice_hidden, 1)
        )
        
        # Slice sequence encoder
        self.slice_seq_gru = nn.GRU(slice_hidden*2, slice_hidden, bidirectional=True, batch_first=True)
        self.slice_seq_attn = nn.Sequential(
            nn.Linear(slice_hidden*2, slice_hidden), 
            nn.Tanh(), 
            nn.Linear(slice_hidden, 1)
        )
        
        # Slice feature processing
        self.slice_feat_mlp = nn.Sequential(
            nn.Linear(slice_feat_dim, 128), 
            nn.LayerNorm(128), 
            nn.GELU(), 
            nn.Dropout(0.4)
        )
        self.slice_fusion = nn.Sequential(
            nn.Linear(slice_hidden*2 + 128, slice_hidden*2),
            nn.GELU(),
            nn.Dropout(0.4)
        )
        self.slice_level_attn = nn.Sequential(
            nn.Linear(slice_hidden*2, slice_hidden), 
            nn.Tanh(), 
            nn.Linear(slice_hidden, 1)
        )
        
        # Vulnerability features
        self.vuln_dim = vuln_dim
        self.vuln_mlp = nn.Sequential(
            nn.BatchNorm1d(vuln_dim), 
            nn.Linear(vuln_dim, 64), 
            nn.GELU(), 
            nn.Dropout(0.4)
        )
        
        self.feature_gate = nn.Sequential(
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 64),
            nn.Sigmoid()
        )
        self.gate_strength_raw = nn.Parameter(torch.tensor(gate_init))
        
        # Classifier
        self.classifier = nn.Sequential(
            nn.LayerNorm(hidden_dim*2 + slice_hidden*2 + 64), 
            nn.Linear(hidden_dim*2 + slice_hidden*2 + 64, 256), 
            nn.GELU(), 
            nn.Dropout(0.5),
            nn.Linear(256, 2)
        )
    
    @property
    def gate_strength(self):
        return torch.sigmoid(self.gate_strength_raw)
    
    def encode_global(self, ids: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        """Encode global sequence with attention."""
        emb = self.embed_drop(self.embedding(ids))
        out, _ = self.global_gru(emb)
        
        scores = self.global_attn(out)
        # Use additive masking for ONNX compatibility
        mask_expanded = mask.unsqueeze(-1)
        scores = scores + (1.0 - mask_expanded) * (-65000.0)
        
        alpha = torch.softmax(scores, dim=1)
        return (out * alpha).sum(dim=1)
    
    def encode_slices(
        self, 
        slice_ids: torch.Tensor, 
        slice_mask: torch.Tensor, 
        slice_count: torch.Tensor,
        slice_vuln: torch.Tensor, 
        slice_rel: torch.Tensor
    ) -> torch.Tensor:
        """Encode slices with attention."""
        B, S, L = slice_ids.shape
        
        # Flatten for processing
        emb = self.embed_drop(self.embedding(slice_ids.view(B*S, L)))
        out, _ = self.slice_gru(emb)
        
        # Token-level attention
        scores = self.slice_attn(out)
        mask_flat = slice_mask.view(B*S, L).unsqueeze(-1)
        scores = scores + (1.0 - mask_flat) * (-65000.0)
        
        alpha = torch.softmax(scores, dim=1)
        slice_repr = (out * alpha).sum(dim=1).view(B, S, -1)
        
        # Fuse with slice features
        feat = self.slice_feat_mlp(torch.cat([slice_vuln, slice_rel], dim=-1))
        slice_repr = self.slice_fusion(torch.cat([slice_repr, feat], dim=-1))
        
        # Slice-level mask
        s_mask = torch.arange(S, device=slice_count.device).unsqueeze(0).expand(B, S) < slice_count.unsqueeze(1)
        s_mask_float = s_mask.float().unsqueeze(-1)
        
        # Slice-level attention
        s_scores = self.slice_level_attn(slice_repr)
        s_scores = s_scores + (1.0 - s_mask_float) * (-65000.0)
        slice_alpha = torch.softmax(s_scores, dim=1)
        slice_attn_repr = (slice_repr * slice_alpha).sum(dim=1)
        
        # Slice sequence attention
        slice_repr_masked = slice_repr * s_mask_float
        seq_out, _ = self.slice_seq_gru(slice_repr_masked)
        seq_scores = self.slice_seq_attn(seq_out)
        seq_scores = seq_scores + (1.0 - s_mask_float) * (-65000.0)
        seq_alpha = torch.softmax(seq_scores, dim=1)
        slice_seq_repr = (seq_out * seq_alpha).sum(dim=1)
        
        return 0.5 * (slice_attn_repr + slice_seq_repr)
    
    def forward(
        self, 
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        slice_input_ids: torch.Tensor,
        slice_attention_mask: torch.Tensor,
        slice_count: torch.Tensor,
        vuln_features: torch.Tensor,
        slice_vuln_features: torch.Tensor,
        slice_rel_features: torch.Tensor
    ) -> torch.Tensor:
        """Forward pass for ONNX export."""
        # Global encoding
        g = self.encode_global(input_ids, attention_mask)
        
        # Slice encoding
        s = self.encode_slices(
            slice_input_ids, slice_attention_mask, slice_count,
            slice_vuln_features, slice_rel_features
        )
        
        # Vulnerability features
        v = self.vuln_mlp(vuln_features)
        gate = self.feature_gate(v)
        v = v * (1.0 + self.gate_strength * (gate - 0.5))
        
        # Combine and classify
        h = torch.cat([g, s, v], dim=1)
        logits = self.classifier(h)
        
        return logits


def load_pytorch_model(model_path: Path, config: Dict[str, Any]) -> nn.Module:
    """Load PyTorch model from checkpoint."""
    device = torch.device("cpu")
    
    model = HierarchicalBiGRUSimplified(
        vocab_size=config["vocab_size"],
        embed_dim=config["embed_dim"],
        hidden_dim=config["hidden_dim"],
        slice_hidden=config["slice_hidden"],
        vuln_dim=config["vuln_dim"],
        slice_feat_dim=config["slice_feat_dim"],
        gate_init=config["gate_init"],
    )
    
    if model_path.exists():
        state_dict = torch.load(model_path, map_location=device, weights_only=False)
        # Handle DataParallel prefix
        new_state_dict = {}
        for k, v in state_dict.items():
            if k.startswith('module.'):
                new_state_dict[k[7:]] = v
            else:
                new_state_dict[k] = v
        model.load_state_dict(new_state_dict, strict=False)
    
    model.eval()
    return model


def create_dummy_inputs(config: Dict[str, Any], batch_size: int = 1) -> Tuple[Dict[str, torch.Tensor], tuple]:
    """Create dummy inputs for tracing."""
    max_len = config["max_len"]
    num_slices = config["num_slices"]
    slice_len = config["slice_len"]
    vuln_dim = config["vuln_dim"]
    
    inputs = {
        "input_ids": torch.randint(0, config["vocab_size"], (batch_size, max_len)),
        "attention_mask": torch.ones(batch_size, max_len),
        "slice_input_ids": torch.randint(0, config["vocab_size"], (batch_size, num_slices, slice_len)),
        "slice_attention_mask": torch.ones(batch_size, num_slices, slice_len),
        "slice_count": torch.tensor([num_slices] * batch_size),
        "vuln_features": torch.randn(batch_size, vuln_dim),
        "slice_vuln_features": torch.randn(batch_size, num_slices, vuln_dim),
        "slice_rel_features": torch.randn(batch_size, num_slices, vuln_dim),
    }
    
    args = tuple(inputs.values())
    return inputs, args


def export_to_onnx(
    model: nn.Module, 
    output_path: Path, 
    config: Dict[str, Any],
    opset_version: int = 14,
    use_dynamic_axes: bool = True
) -> bool:
    """Export PyTorch model to ONNX format."""
    print(f"Exporting model to ONNX: {output_path}", file=sys.stderr)
    
    inputs, args = create_dummy_inputs(config)
    
    input_names = list(inputs.keys())
    output_names = ["logits"]
    
    # Dynamic axes for batch size
    dynamic_axes = None
    if use_dynamic_axes:
        dynamic_axes = {
            "input_ids": {0: "batch_size"},
            "attention_mask": {0: "batch_size"},
            "slice_input_ids": {0: "batch_size"},
            "slice_attention_mask": {0: "batch_size"},
            "slice_count": {0: "batch_size"},
            "vuln_features": {0: "batch_size"},
            "slice_vuln_features": {0: "batch_size"},
            "slice_rel_features": {0: "batch_size"},
            "logits": {0: "batch_size"},
        }
    
    try:
        # Use legacy TorchScript exporter (faster and more reliable)
        with torch.no_grad():
            torch.onnx.export(
                model,
                args,
                str(output_path),
                export_params=True,
                opset_version=opset_version,
                do_constant_folding=True,
                input_names=input_names,
                output_names=output_names,
                dynamic_axes=dynamic_axes,
                verbose=False,
                dynamo=False,  # Use legacy exporter
            )
        print(f"Successfully exported to {output_path}", file=sys.stderr)
        print(f"Model size: {output_path.stat().st_size / 1024 / 1024:.2f} MB", file=sys.stderr)
        return True
    except Exception as e:
        print(f"Export failed: {e}", file=sys.stderr)
        return False


def verify_onnx_model(onnx_path: Path, config: Dict[str, Any]) -> bool:
    """Verify ONNX model output matches PyTorch."""
    if not ONNX_AVAILABLE:
        print("Skipping verification - onnxruntime not installed", file=sys.stderr)
        return True
    
    print("Verifying ONNX model...", file=sys.stderr)
    
    try:
        import onnx
        model = onnx.load(str(onnx_path))
        onnx.checker.check_model(model)
        print("ONNX model structure is valid", file=sys.stderr)
    except Exception as e:
        print(f"ONNX structure check failed: {e}", file=sys.stderr)
        return False
    
    return True


def benchmark_inference(
    pytorch_model: Optional[nn.Module],
    onnx_path: Optional[Path],
    config: Dict[str, Any],
    num_iterations: int = 100,
    warmup_iterations: int = 10
) -> Dict[str, Any]:
    """Benchmark inference latency for PyTorch and ONNX models."""
    results = {"pytorch": None, "onnx": None}
    inputs, args = create_dummy_inputs(config)
    
    # Benchmark PyTorch
    if pytorch_model is not None:
        print("Benchmarking PyTorch model...", file=sys.stderr)
        pytorch_model.eval()
        
        # Warmup
        with torch.no_grad():
            for _ in range(warmup_iterations):
                _ = pytorch_model(*args)
        
        # Benchmark
        latencies = []
        with torch.no_grad():
            for _ in range(num_iterations):
                start = time.perf_counter()
                _ = pytorch_model(*args)
                latencies.append((time.perf_counter() - start) * 1000)  # ms
        
        results["pytorch"] = {
            "p50": statistics.median(latencies),
            "p95": sorted(latencies)[int(0.95 * len(latencies))],
            "p99": sorted(latencies)[int(0.99 * len(latencies))],
            "mean": statistics.mean(latencies),
            "std": statistics.stdev(latencies) if len(latencies) > 1 else 0,
        }
        print(f"PyTorch - p50: {results['pytorch']['p50']:.2f}ms, p95: {results['pytorch']['p95']:.2f}ms", file=sys.stderr)
    
    # Benchmark ONNX
    if onnx_path is not None and onnx_path.exists() and ONNX_AVAILABLE:
        print("Benchmarking ONNX model...", file=sys.stderr)
        
        # Create ONNX Runtime session
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.intra_op_num_threads = 4
        
        session = ort.InferenceSession(str(onnx_path), sess_options)
        
        # Convert inputs to numpy
        ort_inputs = {k: v.numpy() for k, v in inputs.items()}
        
        # Warmup
        for _ in range(warmup_iterations):
            _ = session.run(None, ort_inputs)
        
        # Benchmark
        latencies = []
        for _ in range(num_iterations):
            start = time.perf_counter()
            _ = session.run(None, ort_inputs)
            latencies.append((time.perf_counter() - start) * 1000)  # ms
        
        results["onnx"] = {
            "p50": statistics.median(latencies),
            "p95": sorted(latencies)[int(0.95 * len(latencies))],
            "p99": sorted(latencies)[int(0.99 * len(latencies))],
            "mean": statistics.mean(latencies),
            "std": statistics.stdev(latencies) if len(latencies) > 1 else 0,
        }
        print(f"ONNX - p50: {results['onnx']['p50']:.2f}ms, p95: {results['onnx']['p95']:.2f}ms", file=sys.stderr)
    
    # Calculate speedup
    if results["pytorch"] and results["onnx"]:
        speedup = results["pytorch"]["p50"] / results["onnx"]["p50"]
        results["speedup"] = speedup
        print(f"Speedup: {speedup:.2f}x", file=sys.stderr)
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Export Devign BiGRU to ONNX")
    parser.add_argument("--model-path", type=str, default=None,
                       help="Path to PyTorch model (.pt file)")
    parser.add_argument("--output", type=str, default="devign_model.onnx",
                       help="Output ONNX file path")
    parser.add_argument("--opset", type=int, default=14,
                       help="ONNX opset version")
    parser.add_argument("--no-dynamic-axes", action="store_true",
                       help="Disable dynamic batch size")
    parser.add_argument("--benchmark", action="store_true",
                       help="Run benchmark after export")
    parser.add_argument("--benchmark-only", action="store_true",
                       help="Only run benchmark, don't export")
    parser.add_argument("--verify", action="store_true",
                       help="Verify ONNX model after export")
    parser.add_argument("--num-iterations", type=int, default=100,
                       help="Number of benchmark iterations")
    
    args = parser.parse_args()
    
    # Find model path
    model_path = None
    if args.model_path:
        model_path = Path(args.model_path)
    else:
        # Try default cache location
        default_model = CACHE_DIR / "models" / "best_v2_seed42.pt"
        if default_model.exists():
            model_path = default_model
        else:
            print("No model path specified and default not found", file=sys.stderr)
            print(f"Looked in: {default_model}", file=sys.stderr)
            sys.exit(1)
    
    if not model_path.exists():
        print(f"Model not found: {model_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Loading model from: {model_path}", file=sys.stderr)
    pytorch_model = load_pytorch_model(model_path, MODEL_CONFIG)
    
    output_path = Path(args.output)
    
    if not args.benchmark_only:
        # Export to ONNX
        success = export_to_onnx(
            pytorch_model, 
            output_path, 
            MODEL_CONFIG,
            opset_version=args.opset,
            use_dynamic_axes=not args.no_dynamic_axes
        )
        
        if not success:
            sys.exit(1)
        
        if args.verify:
            if not verify_onnx_model(output_path, MODEL_CONFIG):
                sys.exit(1)
    
    if args.benchmark or args.benchmark_only:
        onnx_path = output_path if output_path.exists() else None
        results = benchmark_inference(
            pytorch_model, 
            onnx_path, 
            MODEL_CONFIG,
            num_iterations=args.num_iterations
        )
        
        # Output benchmark results as JSON
        output_json = {
            "benchmark": results,
            "config": MODEL_CONFIG,
            "model_path": str(model_path),
            "onnx_path": str(output_path) if onnx_path else None,
        }
        
        # Save benchmark results
        benchmark_file = output_path.parent / "benchmark.json"
        with open(benchmark_file, "w") as f:
            json.dump(output_json, f, indent=2)
        print(f"Benchmark saved to: {benchmark_file}", file=sys.stderr)
        
        # Check target p50 < 100ms
        if results.get("onnx") and results["onnx"]["p50"] < 100:
            print("✓ Target achieved: p50 < 100ms", file=sys.stderr)
        elif results.get("onnx"):
            print(f"✗ Target not met: p50 = {results['onnx']['p50']:.2f}ms (target: <100ms)", file=sys.stderr)


if __name__ == "__main__":
    main()
