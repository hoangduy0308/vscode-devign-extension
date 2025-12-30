#!/usr/bin/env python3
"""
Hash-based Scan Result Cache for Devign Scanner.

Provides LRU caching of scan results by code hash to skip redundant scans.
Target: Skip 60%+ of duplicate scans.

Features:
- In-memory LRU cache with configurable size
- Optional disk persistence for cross-session caching
- Thread-safe operations
- Automatic cache invalidation on model version change

Usage:
    from scan_cache import ScanCache, get_scan_cache
    
    cache = get_scan_cache()
    
    # Check cache before scanning
    result = cache.get(code)
    if result is None:
        result = scanner.predict(code)
        cache.put(code, result)
"""

import hashlib
import json
import logging
import os
import sqlite3
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Default cache directory
DEFAULT_CACHE_DIR = Path.home() / "AppData" / "Local" / "devign-scanner" / "cache"

# Cache configuration
DEFAULT_MAX_SIZE = 10000  # Max entries in memory
DEFAULT_TTL_HOURS = 24 * 7  # 1 week TTL
DEFAULT_MODEL_VERSION = "v2.0-onnx"


@dataclass
class CachedResult:
    """Cached scan result."""
    vulnerable: bool
    score: float
    threshold: float
    confidence: str
    detected_patterns: List[str]
    cached_at: str
    model_version: str
    code_hash: str


@dataclass
class CacheStats:
    """Cache statistics."""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    memory_entries: int = 0
    disk_entries: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0


class LRUCache:
    """Thread-safe LRU cache implementation."""
    
    def __init__(self, max_size: int = DEFAULT_MAX_SIZE):
        self.max_size = max_size
        self._cache: OrderedDict[str, CachedResult] = OrderedDict()
        self._lock = threading.RLock()
        self._stats = CacheStats()
    
    def get(self, key: str) -> Optional[CachedResult]:
        """Get item from cache, updating access order."""
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                self._stats.hits += 1
                return self._cache[key]
            self._stats.misses += 1
            return None
    
    def put(self, key: str, value: CachedResult) -> None:
        """Add item to cache, evicting oldest if necessary."""
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                if len(self._cache) >= self.max_size:
                    self._cache.popitem(last=False)
                    self._stats.evictions += 1
            self._cache[key] = value
            self._stats.memory_entries = len(self._cache)
    
    def contains(self, key: str) -> bool:
        """Check if key is in cache without updating access order."""
        with self._lock:
            return key in self._cache
    
    def remove(self, key: str) -> bool:
        """Remove item from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._stats.memory_entries = len(self._cache)
                return True
            return False
    
    def clear(self) -> int:
        """Clear all cache entries. Returns number cleared."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._stats.memory_entries = 0
            return count
    
    def get_stats(self) -> CacheStats:
        """Get cache statistics."""
        with self._lock:
            return CacheStats(
                hits=self._stats.hits,
                misses=self._stats.misses,
                evictions=self._stats.evictions,
                memory_entries=len(self._cache),
                disk_entries=self._stats.disk_entries,
            )


class DiskCache:
    """SQLite-based disk cache for persistence across sessions."""
    
    def __init__(
        self, 
        cache_dir: Path = DEFAULT_CACHE_DIR,
        ttl_hours: int = DEFAULT_TTL_HOURS,
        model_version: str = DEFAULT_MODEL_VERSION
    ):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.cache_dir / "scan_cache.db"
        self.ttl_hours = ttl_hours
        self.model_version = model_version
        self._lock = threading.RLock()
        
        self._init_db()
    
    def _init_db(self) -> None:
        """Initialize SQLite database."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS scan_cache (
                        code_hash TEXT PRIMARY KEY,
                        vulnerable INTEGER NOT NULL,
                        score REAL NOT NULL,
                        threshold REAL NOT NULL,
                        confidence TEXT NOT NULL,
                        detected_patterns TEXT NOT NULL,
                        cached_at TEXT NOT NULL,
                        model_version TEXT NOT NULL,
                        last_accessed TEXT NOT NULL
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_model_version 
                    ON scan_cache(model_version)
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_last_accessed 
                    ON scan_cache(last_accessed)
                """)
                conn.commit()
            finally:
                conn.close()
    
    def get(self, code_hash: str) -> Optional[CachedResult]:
        """Get cached result from disk."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                cursor = conn.execute(
                    """SELECT vulnerable, score, threshold, confidence, 
                              detected_patterns, cached_at, model_version, code_hash
                       FROM scan_cache 
                       WHERE code_hash = ? AND model_version = ?""",
                    (code_hash, self.model_version)
                )
                row = cursor.fetchone()
                
                if row is None:
                    return None
                
                # Check TTL
                cached_at = datetime.fromisoformat(row[5])
                if datetime.now() - cached_at > timedelta(hours=self.ttl_hours):
                    conn.execute("DELETE FROM scan_cache WHERE code_hash = ?", (code_hash,))
                    conn.commit()
                    return None
                
                # Update last accessed
                conn.execute(
                    "UPDATE scan_cache SET last_accessed = ? WHERE code_hash = ?",
                    (datetime.now().isoformat(), code_hash)
                )
                conn.commit()
                
                return CachedResult(
                    vulnerable=bool(row[0]),
                    score=row[1],
                    threshold=row[2],
                    confidence=row[3],
                    detected_patterns=json.loads(row[4]),
                    cached_at=row[5],
                    model_version=row[6],
                    code_hash=row[7],
                )
            finally:
                conn.close()
    
    def put(self, result: CachedResult) -> None:
        """Store result to disk cache."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                conn.execute(
                    """INSERT OR REPLACE INTO scan_cache 
                       (code_hash, vulnerable, score, threshold, confidence, 
                        detected_patterns, cached_at, model_version, last_accessed)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        result.code_hash,
                        int(result.vulnerable),
                        result.score,
                        result.threshold,
                        result.confidence,
                        json.dumps(result.detected_patterns),
                        result.cached_at,
                        result.model_version,
                        datetime.now().isoformat(),
                    )
                )
                conn.commit()
            finally:
                conn.close()
    
    def count(self) -> int:
        """Count entries in disk cache."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM scan_cache WHERE model_version = ?",
                    (self.model_version,)
                )
                return cursor.fetchone()[0]
            finally:
                conn.close()
    
    def cleanup_expired(self) -> int:
        """Remove expired entries. Returns count removed."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                cutoff = (datetime.now() - timedelta(hours=self.ttl_hours)).isoformat()
                cursor = conn.execute(
                    "DELETE FROM scan_cache WHERE cached_at < ?",
                    (cutoff,)
                )
                conn.commit()
                return cursor.rowcount
            finally:
                conn.close()
    
    def cleanup_old_versions(self) -> int:
        """Remove entries from older model versions."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                cursor = conn.execute(
                    "DELETE FROM scan_cache WHERE model_version != ?",
                    (self.model_version,)
                )
                conn.commit()
                return cursor.rowcount
            finally:
                conn.close()
    
    def clear(self) -> int:
        """Clear all entries. Returns count removed."""
        with self._lock:
            conn = sqlite3.connect(str(self.db_path))
            try:
                cursor = conn.execute("DELETE FROM scan_cache")
                conn.commit()
                return cursor.rowcount
            finally:
                conn.close()


class ScanCache:
    """Two-level cache: in-memory LRU + optional disk persistence."""
    
    def __init__(
        self,
        max_memory_size: int = DEFAULT_MAX_SIZE,
        use_disk_cache: bool = True,
        cache_dir: Optional[Path] = None,
        ttl_hours: int = DEFAULT_TTL_HOURS,
        model_version: str = DEFAULT_MODEL_VERSION,
    ):
        self.memory_cache = LRUCache(max_size=max_memory_size)
        self.model_version = model_version
        
        self.disk_cache: Optional[DiskCache] = None
        if use_disk_cache:
            self.disk_cache = DiskCache(
                cache_dir=cache_dir or DEFAULT_CACHE_DIR,
                ttl_hours=ttl_hours,
                model_version=model_version,
            )
    
    @staticmethod
    def compute_hash(code: str) -> str:
        """Compute SHA-256 hash of code for cache key."""
        # Normalize: strip whitespace, lowercase
        normalized = code.strip()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:32]
    
    def get(self, code: str) -> Optional[Dict[str, Any]]:
        """Get cached result for code. Returns None if not cached."""
        code_hash = self.compute_hash(code)
        
        # Check memory first
        result = self.memory_cache.get(code_hash)
        if result is not None:
            logger.debug(f"Cache hit (memory): {code_hash[:8]}")
            return asdict(result)
        
        # Check disk
        if self.disk_cache is not None:
            result = self.disk_cache.get(code_hash)
            if result is not None:
                # Promote to memory cache
                self.memory_cache.put(code_hash, result)
                logger.debug(f"Cache hit (disk): {code_hash[:8]}")
                return asdict(result)
        
        logger.debug(f"Cache miss: {code_hash[:8]}")
        return None
    
    def put(
        self, 
        code: str, 
        vulnerable: bool,
        score: float,
        threshold: float,
        confidence: str,
        detected_patterns: List[str],
    ) -> str:
        """Store scan result in cache. Returns code hash."""
        code_hash = self.compute_hash(code)
        
        result = CachedResult(
            vulnerable=vulnerable,
            score=score,
            threshold=threshold,
            confidence=confidence,
            detected_patterns=detected_patterns,
            cached_at=datetime.now().isoformat(),
            model_version=self.model_version,
            code_hash=code_hash,
        )
        
        # Store in memory
        self.memory_cache.put(code_hash, result)
        
        # Store to disk
        if self.disk_cache is not None:
            self.disk_cache.put(result)
        
        logger.debug(f"Cached: {code_hash[:8]}")
        return code_hash
    
    def invalidate(self, code: str) -> bool:
        """Remove cached result for code. Returns True if found."""
        code_hash = self.compute_hash(code)
        found = self.memory_cache.remove(code_hash)
        return found
    
    def clear(self) -> Dict[str, int]:
        """Clear all caches. Returns counts cleared."""
        memory_cleared = self.memory_cache.clear()
        disk_cleared = 0
        if self.disk_cache is not None:
            disk_cleared = self.disk_cache.clear()
        return {"memory": memory_cleared, "disk": disk_cleared}
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = self.memory_cache.get_stats()
        if self.disk_cache is not None:
            stats.disk_entries = self.disk_cache.count()
        
        return {
            "hits": stats.hits,
            "misses": stats.misses,
            "hit_rate": round(stats.hit_rate * 100, 2),
            "evictions": stats.evictions,
            "memory_entries": stats.memory_entries,
            "disk_entries": stats.disk_entries,
            "model_version": self.model_version,
        }
    
    def cleanup(self) -> Dict[str, int]:
        """Cleanup expired and old version entries."""
        result = {"expired": 0, "old_versions": 0}
        if self.disk_cache is not None:
            result["expired"] = self.disk_cache.cleanup_expired()
            result["old_versions"] = self.disk_cache.cleanup_old_versions()
        return result


# Singleton cache
_scan_cache: Optional[ScanCache] = None
_cache_lock = threading.Lock()


def get_scan_cache(
    max_memory_size: int = DEFAULT_MAX_SIZE,
    use_disk_cache: bool = True,
    model_version: str = DEFAULT_MODEL_VERSION,
) -> ScanCache:
    """Get singleton scan cache instance."""
    global _scan_cache
    with _cache_lock:
        if _scan_cache is None:
            _scan_cache = ScanCache(
                max_memory_size=max_memory_size,
                use_disk_cache=use_disk_cache,
                model_version=model_version,
            )
        return _scan_cache


def reset_scan_cache() -> None:
    """Reset the singleton cache (for testing)."""
    global _scan_cache
    with _cache_lock:
        _scan_cache = None


if __name__ == "__main__":
    # Test the cache
    import random
    
    cache = get_scan_cache()
    
    # Generate test data
    test_codes = [
        f"void func_{i}(int x) {{ return x * {i}; }}" 
        for i in range(100)
    ]
    
    # Simulate scans
    print("Simulating 1000 scans with 100 unique codes...")
    start = time.time()
    
    for _ in range(1000):
        code = random.choice(test_codes)
        result = cache.get(code)
        
        if result is None:
            # Simulate scan
            cache.put(
                code,
                vulnerable=random.random() > 0.7,
                score=random.random(),
                threshold=0.65,
                confidence="medium",
                detected_patterns=[],
            )
    
    elapsed = time.time() - start
    stats = cache.get_stats()
    
    print(f"\nCache Statistics:")
    print(f"  Hits: {stats['hits']}")
    print(f"  Misses: {stats['misses']}")
    print(f"  Hit Rate: {stats['hit_rate']}%")
    print(f"  Memory Entries: {stats['memory_entries']}")
    print(f"  Disk Entries: {stats['disk_entries']}")
    print(f"\nTime: {elapsed:.3f}s")
    
    # Target check
    if stats['hit_rate'] >= 60:
        print("[OK] Target achieved: Hit rate >= 60%")
    else:
        print(f"[FAIL] Target not met: Hit rate = {stats['hit_rate']}% (target: >=60%)")
