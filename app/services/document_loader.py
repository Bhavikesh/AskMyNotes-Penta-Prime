import fitz  # PyMuPDF
import docx
import email
from email import policy
from bs4 import BeautifulSoup
import httpx
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class DocumentLoader:

    @staticmethod
    async def load_from_local_file(file_path: str) -> bytes:
        """Load document from local file system"""
        try:
            from pathlib import Path
            
            path = Path(file_path)
            
            if not path.exists():
                raise ValueError(f"File not found: {file_path}")
            
            if not path.is_file():
                raise ValueError(f"Path is not a file: {file_path}")
            
            with open(path, 'rb') as f:
                content = f.read()
            
            logger.info(f"Loaded local file: {file_path} ({len(content)} bytes)")
            return content
        
        except Exception as e:
            logger.error(f"Failed to load local file: {e}")
            raise ValueError(f"Failed to load file: {str(e)}")




    @staticmethod
    async def download_document(url: str) -> bytes:
        """Download document from URL (Azure Blob, etc.)"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.error(f"Failed to download document: {e}")
            raise ValueError(f"Document download failed: {str(e)}")
    
    @staticmethod
    def extract_text_from_pdf(content: bytes) -> str:
        """Extract text from PDF with structure preservation"""
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            text_parts = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text("text")
                text_parts.append(f"--- Page {page_num + 1} ---\n{text}")
            
            doc.close()
            return "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise ValueError(f"Failed to parse PDF: {str(e)}")
    
    @staticmethod
    def extract_text_from_docx(content: bytes) -> str:
        """Extract text from DOCX"""
        try:
            import io
            doc = docx.Document(io.BytesIO(content))
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            return "\n\n".join(paragraphs)
        except Exception as e:
            logger.error(f"DOCX extraction failed: {e}")
            raise ValueError(f"Failed to parse DOCX: {str(e)}")
    
    @staticmethod
    def extract_text_from_eml(content: bytes) -> str:
        """Extract text from email files"""
        try:
            msg = email.message_from_bytes(content, policy=policy.default)
            
            # Extract subject and sender
            subject = msg.get('subject', '')
            sender = msg.get('from', '')
            
            # Extract body
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    elif part.get_content_type() == "text/html":
                        html = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        soup = BeautifulSoup(html, 'lxml')
                        body += soup.get_text()
            else:
                body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
            
            return f"Subject: {subject}\nFrom: {sender}\n\n{body}"
        except Exception as e:
            logger.error(f"EML extraction failed: {e}")
            raise ValueError(f"Failed to parse email: {str(e)}")
    
    @staticmethod
    async def load_and_extract(url: str) -> str:
        """Main method to load and extract text from any supported format"""
        
        # Check if it's a local file path (no URL scheme)
        is_local = (
            url.startswith("file://")
            or not url.startswith(("http://", "https://"))
        )

        if is_local:
            # Resolve the actual path
            if url.startswith("file://"):
                file_path = url.replace("file://", "")
                if file_path.startswith("/") and ":" in file_path:
                    file_path = file_path.lstrip("/")
            else:
                file_path = url

            logger.info(f"Loading local file: {file_path}")

            try:
                from pathlib import Path

                path = Path(file_path)

                if not path.exists():
                    raise ValueError(f"File not found: {file_path}")

                if not path.is_file():
                    raise ValueError(f"Path is not a file: {file_path}")

                with open(path, 'rb') as f:
                    content = f.read()

                logger.info(f"Loaded local file: {file_path} ({len(content)} bytes)")

            except ValueError:
                raise
            except Exception as e:
                logger.error(f"Failed to load local file: {e}")
                raise ValueError(f"Failed to load local file: {str(e)}")

        else:
            # Download from URL
            content = await DocumentLoader.download_document(url)
        
        # Detect file type by magic bytes
        if content[:4] == b'%PDF':
            return DocumentLoader.extract_text_from_pdf(content)
        elif content[:2] == b'PK':  # DOCX is a ZIP file
            return DocumentLoader.extract_text_from_docx(content)
        elif b'MIME-Version' in content[:1000] or b'From:' in content[:1000]:
            return DocumentLoader.extract_text_from_eml(content)
        else:
            # Fallback: treat as plain text (.txt files, etc.)
            try:
                return content.decode('utf-8', errors='ignore')
            except Exception:
                raise ValueError("Unsupported document format")