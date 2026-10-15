"""Create a source release with an explicit allowlist; never include local secrets or databases."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent.parent
output = root / 'releases'
output.mkdir(exist_ok=True)
archive = output / 'RepairMe-One-deployment.zip'
files = []
for directory in ['src', 'public', 'scripts', 'supabase', 'tests', 'docs']:
    files.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
for name in ['package.json','package-lock.json','netlify.toml','next.config.ts','next-env.d.ts','tsconfig.json','postcss.config.mjs','eslint.config.mjs','vitest.config.ts','playwright.config.ts','.env.example','.gitignore','.prettierignore','.prettierrc.json','README.md','RELEASE.md']:
    p = root / name
    if p.is_file(): files.append(p)
manifest = []
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for file in sorted(set(files)):
        relative = file.relative_to(root).as_posix()
        if file.name.startswith('.env') and file.name != '.env.example':
            raise RuntimeError('Refusing to package environment secrets')
        bundle.write(file, 'RepairMe-One/' + relative)
        manifest.append({'path': relative, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert not any('/node_modules/' in n or '/.next/' in n or n.endswith('.env.local') for n in bundle.namelist())
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
(output / 'SHA256.txt').write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + '  ' + archive.name + '\n')
print(f'Packaged {len(manifest)} files: {archive}')
