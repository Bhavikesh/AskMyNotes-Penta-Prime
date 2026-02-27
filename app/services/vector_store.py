import faiss
import numpy as np
import os
import pickle
import logging
from typing import List, Tuple, Dict, Optional

logger = logging.getLogger(__name__)

FAISS_INDEX_PATH = "faiss_store/index.bin"
FAISS_CHUNKS_PATH = "faiss_store/chunks.pkl"


class VectorStore:
    def __init__(self, dimension: int):
        self.dimension = dimension
        self.chunks: List[Dict] = []

        # Load from disk if exists, else create fresh
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_CHUNKS_PATH):
            try:
                self.index = faiss.read_index(FAISS_INDEX_PATH)
                with open(FAISS_CHUNKS_PATH, "rb") as f:
                    self.chunks = pickle.load(f)
                logger.info(f"✅ Loaded FAISS index from disk: {self.index.ntotal} vectors")
            except Exception as e:
                logger.warning(f"Could not load FAISS index from disk, starting fresh: {e}")
                self.index = faiss.IndexFlatIP(dimension)
        else:
            self.index = faiss.IndexFlatIP(dimension)
            logger.info(f"FAISS index initialized fresh (dimension={dimension})")

    def _save(self):
        """Persist index and chunk metadata to disk after every write."""
        try:
            os.makedirs("faiss_store", exist_ok=True)
            faiss.write_index(self.index, FAISS_INDEX_PATH)
            with open(FAISS_CHUNKS_PATH, "wb") as f:
                pickle.dump(self.chunks, f)
            logger.info(f"💾 Saved FAISS index to disk: {self.index.ntotal} vectors")
        except Exception as e:
            logger.error(f"Failed to save FAISS index: {e}")

    def add_chunks(self, embeddings: np.ndarray, chunks: List[Dict]):
        """Add document chunks to the index. Returns the starting FAISS index position."""
        if embeddings.shape[1] != self.dimension:
            raise ValueError(f"Embedding dimension mismatch: expected {self.dimension}, got {embeddings.shape[1]}")

        start_idx = self.index.ntotal

        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)

        self.index.add(embeddings)
        self.chunks.extend(chunks)
        logger.info(f"Added {len(chunks)} chunks to index. Total: {self.index.ntotal}")

        # Persist immediately
        self._save()

        return start_idx

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Tuple[Dict, float]]:
        """Search (backward-compat method). Returns (chunk, score) tuples."""
        query_embedding = query_embedding.reshape(1, -1).astype('float32')
        faiss.normalize_L2(query_embedding)

        scores, indices = self.index.search(query_embedding, top_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if 0 <= idx < len(self.chunks):
                results.append((self.chunks[idx], float(score)))
        return results

    def search_by_subject(
        self,
        query_embedding: np.ndarray,
        user_id: str,
        subject_id: str,
        top_k: int = 5,
        score_threshold: float = 0.3,
        supabase_chunks: Optional[List[Dict]] = None,
    ) -> List[Tuple[Dict, float]]:
        """
        Subject-scoped similarity search using Supabase chunk metadata.

        Strategy:
        1. Use pre-fetched supabase_chunks (filtered by user_id + subject_id).
        2. Collect their embedding_id values (FAISS positions).
        3. Run broad FAISS search, filter to allowed embedding_ids.
        4. Apply score_threshold, return top_k results.

        FALLBACK: If FAISS has no vectors for this subject (e.g. after a restart
        before re-ingestion), do a pure text-based retrieval from Supabase rows.
        """
        if not supabase_chunks:
            logger.warning("search_by_subject: no chunks for this subject — returning empty")
            return []

        # ── FAISS path ────────────────────────────────────────────────────────
        allowed_ids = {
            row["embedding_id"]
            for row in supabase_chunks
            if row.get("embedding_id") is not None
        }

        if allowed_ids and self.index.ntotal > 0:
            search_k = min(max(len(allowed_ids), top_k * 10), self.index.ntotal)

            q_emb = query_embedding.reshape(1, -1).astype("float32")
            faiss.normalize_L2(q_emb)
            scores, indices = self.index.search(q_emb, search_k)

            emb_to_row = {
                row["embedding_id"]: row
                for row in supabase_chunks
                if row.get("embedding_id") is not None
            }

            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1 or idx not in allowed_ids:
                    continue
                if float(score) < score_threshold:
                    continue
                row = emb_to_row[idx]
                results.append((_row_to_chunk(row, subject_id), float(score)))
                if len(results) >= top_k:
                    break

            results.sort(key=lambda x: x[1], reverse=True)

            if results:
                return results
            else:
                logger.warning(
                    f"FAISS returned 0 results above threshold={score_threshold} "
                    f"(ntotal={self.index.ntotal}, allowed={len(allowed_ids)}). "
                    "Falling back to Supabase text retrieval."
                )

        # ── Fallback: return top Supabase chunks directly (no FAISS) ──────────
        # This handles the case where the index was wiped but metadata still exists.
        logger.info("Using Supabase text-only fallback — re-upload PDFs to restore vectors.")
        fallback = [
            (_row_to_chunk(row, subject_id), 0.7)
            for row in supabase_chunks[:top_k]
            if row.get("text")
        ]
        return fallback

    @property
    def total(self) -> int:
        return self.index.ntotal

    def clear(self):
        self.index.reset()
        self.chunks = []
        self._save()
        logger.info("Vector store cleared and saved")


def _row_to_chunk(row: Dict, subject_id: str) -> Dict:
    return {
        "text": row["text"],
        "chunk_id": row.get("chunk_id", 0),
        "page_number": row.get("page_number"),
        "file_name": row.get("file_name", ""),
        "subject_id": row.get("subject_id", subject_id),
        "document_id": row.get("document_id"),
    }