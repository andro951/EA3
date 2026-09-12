"""Test-only ESM loader. Executes the real UI with explicit storage/transport doubles.
Never changes browser policy, navigates around a blocked URL, or claims native storage.
"""
from pathlib import Path
import re, json, base64, io
ROOT=Path(__file__).resolve().parents[1]
class Bundler:
    def __init__(self): self.modules={}; self.missing=[]
    def resolve(self,owner,target):
        path=((ROOT/owner).parent/target).resolve()
        return path.relative_to(ROOT).as_posix()
    def load(self,name):
        if name in self.modules:return
        self.modules[name]=''
        file=ROOT/name
        if not file.exists():
            self.missing.append(name)
            self.modules[name]=f'throw new Error({json.dumps("Missing module in this intermediate checkpoint: "+name)});'
            return
        source=file.read_text(encoding='utf-8');exports={}
        if name=='app/main.mjs':source=source.replace("from './storage/repository.mjs'", "from '../tests/support/memory-repository.mjs'")
        if name=='tests/support/memory-repository.mjs':
            source=source.replace('constructor(initial){super();','constructor(initial=globalThis.__offlineInitial){super();globalThis.__offlineRepo=this;')
        if name=='app/core/util.mjs':
            source=source.replace('export function safeImage(value) {','export function safeImage(value) {\n  if(globalThis.__offlineArt[value]) return globalThis.__offlineArt[value];')
            a=source.index('export function download(');b=source.index('export function safeImage(',a)
            source=source[:a]+"export function download(filename,value,type='application/json') { globalThis.__offlineDownloads.push({filename,value,type}); }\n"+source[b:]
        def imp(m):
            names,target=m.group(1),m.group(2);dep=self.resolve(name,target);self.load(dep)
            names=re.sub(r'\b([\w$]+)\s+as\s+([\w$]+)',r'\1: \2',names)
            return f'const {names}=await __load({json.dumps(dep)});'
        source=re.sub(r"import\s+(\{[^}]+\})\s+from\s+['\"]([^'\"]+)['\"];?",imp,source)
        def dynamic(m):
            dep=self.resolve(name,m.group(1));self.load(dep);return f'__load({json.dumps(dep)})'
        source=re.sub(r"import\(['\"]([^'\"]+)['\"]\)",dynamic,source)
        def exp(m):
            for bit in m.group(1).split(','):
                v=bit.strip().split(' as ')
                if v[0]:exports[v[-1]]=v[0]
            return ''
        source=re.sub(r'export\s*\{([^}]+)\};?',exp,source)
        def decl(m):
            prefix,ident=m.group(1),m.group(2);exports[ident]=ident;return prefix+' '+ident
        source=re.sub(r'export\s+((?:async\s+)?function|class|const|let|var)\s+([\w$]+)',decl,source)
        self.modules[name]=source+'\nreturn {'+','.join(json.dumps(k)+':'+v for k,v in exports.items())+'};'
    def code(self,entry='app/main.mjs'):
        self.load(entry)
        code='const __factories={},__cache={};async function __load(name){if(!__cache[name])__cache[name]=__factories[name]();return __cache[name];}\n'
        for name,source in self.modules.items():code+=f'__factories[{json.dumps(name)}]=async()=>{{\n{source}\n}};\n'
        return code+f'globalThis.__offlineLoad=__load;__load({json.dumps(entry)}).catch(e=>{{globalThis.__offlineBootError=String(e.stack||e);console.error(e);}});'
    def art(self):
        from PIL import Image
        import cairosvg
        result={}
        for file in (ROOT/'public/art').iterdir():
            if file.suffix not in {'.png','.jpg','.jpeg','.svg','.webp'}:continue
            if file.suffix=='.svg':
                raw=cairosvg.svg2png(bytestring=file.read_bytes(),output_width=720,output_height=480)
                data='data:image/png;base64,'+base64.b64encode(raw).decode()
            else:
                im=Image.open(file)
                im.thumbnail((1920,1280))
                buffer=io.BytesIO();im.save(buffer,'WEBP',quality=88)
                data='data:image/webp;base64,'+base64.b64encode(buffer.getvalue()).decode()
            result['/public/art/'+file.name]=data
        return result

def styles():
    def expand(path):
        text=path.read_text()
        return re.sub(r'@import url\([\"\'](.+?)[\"\']\);',lambda m:expand((path.parent/m.group(1)).resolve()),text)
    return expand(ROOT/'app/ui/styles.css')
