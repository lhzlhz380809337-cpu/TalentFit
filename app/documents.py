import io
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_FILE = 10 * 1024 * 1024

def extract_text(content, filename):
    if not content:
        raise ValueError('文件为空。')
    if len(content) > MAX_FILE:
        raise ValueError('文件超过 10 MB，请压缩后重试。')
    ext = Path(filename).suffix.lower()
    try:
        if ext == '.txt':
            if content.startswith((b'\xff\xfe', b'\xfe\xff')):
                text = content.decode('utf-16')
            else:
                try:
                    text = content.decode('utf-8-sig')
                except UnicodeDecodeError:
                    text = content.decode('gb18030')
        elif ext == '.docx':
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(info.file_size for info in archive.infolist()) > 50 * 1024 * 1024:
                    raise ValueError('Word 文件解压后过大，请简化内容。')
                root = ET.fromstring(archive.read('word/document.xml'))
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                text = '\n'.join(''.join(p.itertext()) for p in root.iter(ns + 'p'))
        elif ext == '.pdf':
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted and not reader.decrypt(''):
                raise ValueError('PDF 有密码保护，请先解除保护。')
            if len(reader.pages) > 200:
                raise ValueError('PDF 超过 200 页，请只保留简历部分。')
            text = '\n'.join(page.extract_text() or '' for page in reader.pages)
            if len(text.strip()) < 20:
                raise ValueError('无法提取 PDF 文字，可能是扫描件。请先 OCR，或直接粘贴简历文本。')
        else:
            raise ValueError('支持 PDF、DOCX、TXT；旧版 DOC 请先另存为 DOCX。')
    except ValueError:
        raise
    except Exception as error:
        raise ValueError('文件无法读取，可能损坏或格式不正确。请重新导出文件。') from error
    if len(text.strip()) < 10:
        raise ValueError('简历文字不足 10 个字符，请检查文件内容。')
    if len(text) > 500000:
        raise ValueError('文档文字过多，请只保留简历部分。')
    return text.strip()
