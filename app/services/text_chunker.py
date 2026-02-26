from typing import List, Dict
import re

class TextChunker:
    def __init__(self, chunk_size: int = 500, overlap: int = 100):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk_by_sentences(
        self,
        text: str,
        subject: str = "",
        file_name: str = "",
        page_number: int = 1,
    ) -> List[Dict[str, any]]:
        """
        Smart chunking that:
        1. Preserves sentence boundaries
        2. Maintains context with overlap
        3. Keeps metadata (page numbers, section headers, subject, file_name)
        """
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Split into sentences (simple approach)
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence_length = len(sentence.split())
            
            if current_length + sentence_length > self.chunk_size and current_chunk:
                # Save current chunk
                chunk_text = ' '.join(current_chunk)
                chunks.append({
                    'text': chunk_text,
                    'chunk_id': len(chunks),
                    'word_count': current_length,
                    'subject': subject,
                    'file_name': file_name,
                    'page_number': page_number,
                })
                
                # Start new chunk with overlap
                overlap_words = ' '.join(current_chunk).split()[-self.overlap:]
                current_chunk = [' '.join(overlap_words), sentence]
                current_length = len(overlap_words) + sentence_length
            else:
                current_chunk.append(sentence)
                current_length += sentence_length
        
        # Add last chunk
        if current_chunk:
            chunks.append({
                'text': ' '.join(current_chunk),
                'chunk_id': len(chunks),
                'word_count': current_length,
                'subject': subject,
                'file_name': file_name,
                'page_number': page_number,
            })
        
        return chunks

    
    def extract_metadata(self, chunk_text: str) -> Dict[str, any]:
        """Extract metadata like page numbers, section headers"""
        metadata = {}
        
        # Extract page numbers
        page_match = re.search(r'--- Page (\d+) ---', chunk_text)
        if page_match:
            metadata['page'] = int(page_match.group(1))
        
        # Detect section headers (ALL CAPS lines)
        header_match = re.search(r'^([A-Z\s]{10,})$', chunk_text, re.MULTILINE)
        if header_match:
            metadata['section'] = header_match.group(1).strip()
        
        return metadata