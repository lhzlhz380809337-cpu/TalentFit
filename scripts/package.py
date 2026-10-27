"""Create a compact distributable; never include personal data or build caches."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def package():
    output = ROOT / 'release' / 'TalentFit-Windows-x64.zip'
    output.parent.mkdir(exist_ok=True)
    required = ['TalentFit.exe', 'app/server.py', 'python/python.exe', 'dist/index.html']
    for name in required:
        if not (ROOT / name).is_file():
            raise SystemExit('Missing required file: ' + name)
    names = ['app', 'python', 'dist', 'TalentFit.exe', 'LICENSE', 'desktop/使用说明.txt']
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in names:
            source = ROOT / name
            files = source.rglob('*') if source.is_dir() else [source]
            for file in files:
                if not file.is_file() or '__pycache__' in file.parts or file.suffix == '.pyc':
                    continue
                relative = file.relative_to(ROOT).as_posix()
                if relative == 'desktop/使用说明.txt':
                    relative = '使用说明.txt'
                archive.write(file, 'TalentFit/' + relative)
    print(f'Portable ZIP: {output} ({output.stat().st_size / 1024 / 1024:.2f} MiB)')

if __name__ == '__main__':
    package()
