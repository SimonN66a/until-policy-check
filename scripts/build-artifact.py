"""Turn the deployable app into a self-contained claude.ai artifact.

A published artifact is one HTML document that may not fetch anything at runtime,
so the stylesheet, the fonts, the wordmark, the photography and pdf.js all get
inlined. The reading also switches from /api/analyse to the artifact runtime.

  python3 scripts/build-artifact.py until    -> build/until.artifact.html
  python3 scripts/build-artifact.py vodafone -> build/vodafone.artifact.html
"""
import base64, mimetypes, pathlib, re, sys, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF  = pathlib.Path('/tmp/pdfjs/node_modules/pdfjs-dist/build')
OUT  = ROOT / 'build'; OUT.mkdir(exist_ok=True)

def data_uri(rel):
    p = ROOT / 'public' / rel.lstrip('/')
    mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    if p.suffix == '.woff2': mime = 'font/woff2'
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()

def build(html):
    # ---- stylesheet, with its own url() references inlined
    css = (ROOT / 'public/ds/until.css').read_text()
    css = re.sub(r'url\("([^"]+)"\)',
                 lambda m: 'url(%s)' % data_uri('ds/' + m.group(1)), css)
    html = html.replace('<link rel="stylesheet" href="/ds/until.css">',
                        '<style>\n' + css + '\n</style>')

    # ---- photography
    html = re.sub(r'src="(/ds/assets/photography/[^"]+)"',
                  lambda m: 'src="%s"' % data_uri(m.group(1)), html)

    # ---- head tags that point at files an artifact does not have
    for pat in [r'<meta charset="utf-8">\n', r'<meta name="viewport"[^>]*>\n',
                r'<meta name="color-scheme"[^>]*>\n', r'<link rel="icon"[^>]*>\n',
                r'<link rel="preconnect"[^>]*>\n', r'<link rel="preload"[^>]*>\n']:
        html = re.sub(pat, '', html)

    # ---- pdf.js and its worker, inlined; a published page cannot reach a CDN
    tag = '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>'
    if tag in html:
        html = html.replace(tag,
          '<!-- pdf.js 3.11.174, inlined: a published artifact cannot fetch from a CDN. -->\n'
          + '<script type="text/plain" id="pdfWorkerSrc">'
          + (PDF/'pdf.worker.min.js').read_text(encoding='utf-8') + '</script>\n'
          + '<script>' + (PDF/'pdf.min.js').read_text(encoding='utf-8') + '</script>')
    html = re.sub(
      r'      pdfjsLib\.GlobalWorkerOptions\.workerSrc =\n'
      r'        "https://cdnjs\.cloudflare\.com[^"]*";\n',
      '      if (!pdfjsLib.GlobalWorkerOptions.workerSrc){\n'
      '        var ws = document.getElementById("pdfWorkerSrc");\n'
      '        pdfjsLib.GlobalWorkerOptions.workerSrc =\n'
      '          URL.createObjectURL(new Blob([ws.textContent], {type:"text/javascript"}));\n'
      '      }\n', html)

    # ---- ask Claude through the runtime instead of the API route
    html = html.replace('  var HAS_API = true;',
      '  /* Artifact build: no /api/analyse here, so the reading goes through the\n'
      '     claude.ai runtime (the sample capability) instead. */\n'
      '  var HAS_API = false;')
    html = html.replace('''  function askJson(prompt){
    if (sampleFn) return sampleFn.json(prompt, {modelTier:"default"});''',
'''  function askJson(prompt){
    if (sampleFn) return sampleFn.json(prompt, {modelTier:"default"});
    if (!HAS_API){
      var e = new Error("This page could not reach Claude, so your document could not be read.");
      e.code = "not_configured";
      return Promise.reject(e);
    }''')
    return html

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'until'
    src = ROOT / ('public/index.html' if which == 'until' else 'public/vodafone.html')
    html = build(src.read_text())
    dst = OUT / f'{which}.artifact.html'
    dst.write_text(html)
    print(f'{dst}  {len(html)/1048576:.2f} MB  |  cdn refs: {html.count("cdnjs")}  '
          f'|  external hrefs: {len(re.findall(chr(34)+"/ds/", html))}')
