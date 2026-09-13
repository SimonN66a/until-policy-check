import sys
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
OLD='file:///tmp/pc/public/index.html'; NEW='http://localhost:8899/'
with sync_playwright() as p:
    b=p.chromium.launch()
    for scheme in ['light','dark']:
        for w in [1280, 390]:
            shots=[]
            for tag,url in [('old',OLD),('new',NEW)]:
                ctx=b.new_context(viewport={'width':w,'height':900}, color_scheme=scheme)
                pg=ctx.new_page(); errs=[]
                pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.goto(url); pg.wait_for_timeout(1600)
                f='/tmp/app/reg-%s-%s-%d.png'%(tag,scheme,w)
                pg.screenshot(path=f, full_page=True); shots.append(f)
                if tag=='new':
                    m=pg.evaluate("""() => ({fonts:[document.fonts.check('600 27px Tungsten'),document.fonts.check('400 16px D-DIN')],
                      imgs:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length,
                      logo:getComputedStyle(document.querySelector('.wordmark')).webkitMaskImage.slice(0,40)})""")
                ctx.close()
            a,c=[Image.open(s).convert('RGB') for s in shots]
            same_size = a.size==c.size
            if same_size:
                diff=ImageChops.difference(a,c); bbox=diff.getbbox()
                px=sum(1 for p_ in diff.getdata() if p_!=(0,0,0))
                pct=100*px/(a.size[0]*a.size[1])
            print('%-5s %4d  old%s new%s  %s' % (scheme, w, a.size, c.size,
                  ('IDENTICAL' if not bbox else 'diff %.3f%% of pixels, bbox %s'%(pct,bbox)) if same_size else 'SIZE MISMATCH'))
            if w==1280 and scheme=='light': print('       new page:', m, errs[:2])
    b.close()
