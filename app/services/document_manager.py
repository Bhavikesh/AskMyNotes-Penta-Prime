from __future__ import annotations

import json
import hashlib
import logging
import datetime
from pathlib import Path
from typing import Dict, List, Optional
import threading

logger = logging.getLogger(__name__)


class DocumentManager:
    # Class-level cache shared across all instances
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, *args, **kwargs):
        """Singleton pattern to ensure only one instance exists."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(
        self,
        dataset_dir: str = "dataset",
        uploads_dir: str = "uploads",
        metadata_file: str = "dataset/metadata.json",
    ):
        # Only initialize once
        if hasattr(self, '_initialized'):
            return
        
        self. dataset_dir = Path(dataset_dir)
        self.uploads_dir = Path(uploads_dir)
        self.metadata_file = Path(metadata_file)

        # Ensure directories exist
        self.dataset_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_file.parent.mkdir(parents=True, exist_ok=True)

        # In-memory cache keyed by document id
        self. metadata_cache: Dict[str, Dict] = {}
        self._cache_timestamp = None

        # Load metadata once on startup
        self._load_metadata()
        self._verify_and_sync_metadata()
        
        self._initialized = True
        logger.info("DocumentManager initialized with %d documents", len(self.metadata_cache))

    # -------------------------
    # Public API
    # -------------------------
    def list_available_documents(self) -> List[Dict]:
        """Return a list of document metadata dicts (cached)."""
        return sorted(self.metadata_cache.values(), key=lambda d: d. get("display_name", ""))

    def get_document_by_id(self, doc_id: str) -> Optional[Dict]:
        """Return the metadata dict for a given document id or None."""
        return self.metadata_cache.get(doc_id)

    def find_document_by_filename(self, filename: str) -> Optional[Dict]:
        """Find a document by its filename (exact match)."""
        for doc in self.metadata_cache.values():
            if doc.get("filename") == filename:
                return doc
        return None

    def register_uploaded_document(self, file_path: str, filename: Optional[str] = None, company: Optional[str] = None) -> Dict:
        """
        Register an uploaded file into metadata and return the metadata entry.
        """
        p = Path(file_path)
        filename = filename or p.name
        file_path_posix = str(p.resolve(). as_posix())

        # If already registered by path, return existing
        for doc in self.metadata_cache. values():
            if doc.get("path") == file_path_posix:
                logger.debug("Document already registered: %s", doc.get("id"))
                return doc

        # Gather file info
        try:
            size = p.stat().st_size
        except Exception:
            size = 0

        # Create unique id
        id_source = f"{file_path_posix}-{datetime.datetime.utcnow().timestamp()}"
        doc_id = self._generate_id_for_file(id_source)

        display_name = self._format_display_name(filename)
        company_name = company or self._extract_company_name(filename)

        doc_entry = {
            "id": doc_id,
            "filename": filename,
            "display_name": display_name,
            "company": company_name,
            "size": size,
            "source": "upload",
            "path": file_path_posix,
            "uploaded_at": datetime.datetime.utcnow().isoformat(),
        }

        # Persist
        self.metadata_cache[doc_id] = doc_entry
        self._persist_metadata()

        logger.info("Registered uploaded document %s (%s)", doc_id, filename)
        return doc_entry

    def delete_uploaded_document(self, doc_id: str) -> bool:
        """Delete an uploaded document's file and remove metadata."""
        doc = self.get_document_by_id(doc_id)
        if not doc:
            return False
        if doc.get("source") != "upload":
            logger.warning("Attempted to delete non-upload document %s", doc_id)
            return False

        path = Path(doc. get("path"))
        try:
            if path.exists():
                path.unlink()
        except Exception as exc:
            logger.exception("Failed to delete file %s: %s", path, exc)

        # remove metadata and persist
        self.metadata_cache.pop(doc_id, None)
        self._persist_metadata()
        logger.info("Deleted uploaded document metadata %s", doc_id)
        return True

    def get_document_path(self, doc_id: str) -> Optional[str]:
        """Return the absolute filesystem path for the given document id."""
        doc = self.get_document_by_id(doc_id)
        if not doc:
            return None
        path = doc.get("path")
        if not path:
            return None
        p = Path(path)
        if not p.is_absolute():
            p = (Path. cwd() / p).resolve()
        if not p.exists():
            logger.warning("Document file does not exist on disk: %s (id=%s)", str(p), doc_id)
            return None
        return str(p. as_posix())

    def get_document_file(self, doc_id: str) -> Optional[Path]:
        """Return a pathlib.Path pointing to the file for doc_id if it exists."""
        path = self.get_document_path(doc_id)
        return Path(path) if path else None

    def refresh_metadata(self):
        """Force refresh metadata from disk (call this periodically if needed)."""
        self._verify_and_sync_metadata()
        logger.info("Metadata refreshed, %d documents available", len(self.metadata_cache))

    # -------------------------
    # Internal helpers
    # -------------------------
    def _load_metadata(self):
        """Load metadata. json if present; otherwise build initial metadata."""
        if self.metadata_file.exists():
            try:
                with self.metadata_file.open("r", encoding="utf-8") as f:
                    data = json. load(f)
                    self.metadata_cache = {str(k): v for k, v in data.items()}
                    self._cache_timestamp = datetime. datetime.utcnow()
                    logger.info("Loaded metadata. json with %d entries", len(self.metadata_cache))
            except Exception as exc:
                logger.exception("Failed to load metadata.json: %s.  Rebuilding.", exc)
                self._scan_and_create_metadata()
        else:
            logger.info("No metadata.json found - scanning directories to create one.")
            self._scan_and_create_metadata()

    def _persist_metadata(self):
        """Write metadata_cache to metadata.json atomically."""
        try:
            tmp = self.metadata_file.with_suffix(".tmp")
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(self.metadata_cache, f, indent=2, ensure_ascii=False)
            tmp.replace(self.metadata_file)
            self._cache_timestamp = datetime.datetime. utcnow()
            logger.debug("Persisted metadata.json with %d entries", len(self. metadata_cache))
        except Exception:
            logger.exception("Failed to persist metadata.json")

    def _scan_and_create_metadata(self):
        """Scan dataset_dir and uploads_dir and build metadata_cache from files found."""
        metadata: Dict[str, Dict] = {}

        def add_file(p: Path, source: str):
            try:
                size = p.stat().st_size
            except Exception:
                size = 0
            
            if source == "dataset":
                id_source = str(p.resolve().as_posix())
            else:
                id_source = f"{str(p.resolve().as_posix())}-{p.stat().st_mtime}"
            
            doc_id = self._generate_id_for_file(id_source)
            filename = p.name
            display_name = self._format_display_name(filename)
            company = self._extract_company_name(filename)

            metadata[doc_id] = {
                "id": doc_id,
                "filename": filename,
                "display_name": display_name,
                "company": company,
                "size": size,
                "source": source,
                "path": str(p.resolve().as_posix()),
                "uploaded_at": None if source == "dataset" else datetime. datetime.utcnow().isoformat(),
            }

        # Scan dataset_dir for common document types
        for ext in ("*.pdf", "*.PDF", "*. docx", "*.DOCX", "*.eml", "*.EML"):
            for p in sorted(self.dataset_dir.glob(ext)):
                if p.is_file():
                    add_file(p, "dataset")

        # Scan uploads_dir
        for p in sorted(self. uploads_dir.glob("*")):
            if p.is_file():
                add_file(p, "upload")

        self.metadata_cache = metadata
        self._persist_metadata()
        logger.info("Scanned directories and created metadata. json with %d entries", len(self.metadata_cache))

    def _verify_and_sync_metadata(self):
        """Verify metadata matches files on disk (only if needed)."""
        # Skip if recently synced (within last 60 seconds)
        if self._cache_timestamp:
            age = (datetime.datetime.utcnow() - self._cache_timestamp). total_seconds()
            if age < 60:
                logger. debug("Skipping sync, metadata is fresh (%. 1fs old)", age)
                return
        
        changed = False

        # Build map of actual files
        actual_files = {}
        for p in self.dataset_dir.glob("*"):
            if p. is_file():
                actual_files[str(p.resolve().as_posix())] = ("dataset", p)
        for p in self.uploads_dir. glob("*"):
            if p.is_file():
                actual_files[str(p.resolve().as_posix())] = ("upload", p)

        # Remove metadata entries whose path doesn't exist
        for doc_id, doc in list(self.metadata_cache.items()):
            path = doc.get("path")
            if not path or path not in actual_files:
                logger.warning("Removing metadata entry for missing file: %s (id=%s)", path, doc_id)
                self.metadata_cache.pop(doc_id)
                changed = True

        # Add files found on disk but not in metadata
        existing_paths = {d. get("path") for d in self.metadata_cache.values() if d.get("path")}
        for path, (source, p) in actual_files.items():
            if path not in existing_paths:
                try:
                    size = p.stat().st_size
                except Exception:
                    size = 0
                
                id_source = f"{path}-{p.stat().st_mtime}"
                doc_id = self._generate_id_for_file(id_source)
                filename = p.name
                display_name = self._format_display_name(filename)
                company = self._extract_company_name(filename)
                
                doc_entry = {
                    "id": doc_id,
                    "filename": filename,
                    "display_name": display_name,
                    "company": company,
                    "size": size,
                    "source": source,
                    "path": path,
                    "uploaded_at": None if source == "dataset" else datetime. datetime.utcnow().isoformat(),
                }
                self.metadata_cache[doc_id] = doc_entry
                logger.info("Added missing file to metadata: %s (id=%s)", filename, doc_id)
                changed = True

        if changed:
            self._persist_metadata()

    def _generate_id_for_file(self, file_path: str) -> str:
        """Generate a short stable id (12 hex chars)."""
        h = hashlib.sha1(file_path.encode("utf-8")).hexdigest()
        return h[:12]

    def _format_display_name(self, filename: str) -> str:
        """Create a nicer display name from filename."""
        name = str(filename)
        if "." in name:
            name = ". ".join(name.split(".")[:-1])
        name = name.replace("_", " ").replace("-", " ")
        name = " ".join(name.split())
        return name. strip()

    def _extract_company_name(self, filename: str) -> Optional[str]:
        """Try to extract a company name from filename."""
        fname = filename.lower()
        known = ["bajaj", "cholamandalam", "edelweiss", "hdfc", "icici", "reliance", "lic", "sbi"]
        for company in known:
            if company in fname:
                return company. title()
        base = filename.split("_")[0]. split("-")[0]
        base = base.split(". ")[0]
        if base:
            return base.title()
        return None