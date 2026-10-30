"""Keep optional Android build tools inside this project, not system directories."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / '.tools'
TOOLS.mkdir(exist_ok=True)

def fetch(url, target):
    if target.exists():
        return target
    temporary = target.with_suffix('.part')
    with urllib.request.urlopen(url, timeout=120) as response, temporary.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    temporary.rename(target)
    print(f'Downloaded {target.name}: {target.stat().st_size:,} bytes', flush=True)
    return target

def main():
    with ThreadPoolExecutor(max_workers=2) as executor:
        jdk = executor.submit(fetch, 'https://corretto.aws/downloads/latest/amazon-corretto-21-aarch64-macos-jdk.tar.gz', TOOLS / 'jdk21.tar.gz')
        sdk = executor.submit(fetch, 'https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip', TOOLS / 'android-cli.zip')
        jdk_path = jdk.result()
        if not (TOOLS / 'jdk').exists():
            (TOOLS / 'jdk').mkdir()
            with tarfile.open(jdk_path) as archive:
                for member in archive.getmembers():
                    if member.name.startswith('/') or '..' in Path(member.name).parts:
                        raise ValueError('Unsafe path in JDK archive')
                archive.extractall(TOOLS / 'jdk')
        sdk_path = sdk.result()
        expected = '835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e'
        if hashlib.sha256(sdk_path.read_bytes()).hexdigest() != expected:
            raise ValueError('Android SDK archive checksum does not match the official download page')
        destination = TOOLS / 'android-sdk' / 'cmdline-tools' / 'latest'
        if not destination.exists():
            destination.mkdir(parents=True)
            with zipfile.ZipFile(sdk_path) as archive:
                for item in archive.infolist():
                    path = Path(item.filename)
                    relative = Path(*path.parts[1:])
                    if not relative.parts or item.is_dir():
                        continue
                    target = destination / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(item))
                    if relative.parts[0] == 'bin':
                        target.chmod(0o755)
    print('Android command-line tools are ready in .tools/', flush=True)

if __name__ == '__main__':
    main()
