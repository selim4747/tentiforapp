import argparse,asyncio,datetime,json,re
from pathlib import Path
from playwright.async_api import async_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--base',default='http://127.0.0.1:3100/')
parser.add_argument('--out',default='artifacts/terminal-responsive')
args=parser.parse_args();OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
CASES=[('chromium',320,568),('chromium',360,800),('chromium',390,844),('chromium',412,915),('chromium',640,360),('chromium',844,390),('chromium',768,1024),('chromium',1366,768),('chromium',1920,1080),('firefox',390,844),('firefox',1366,768),('webkit',320,568),('webkit',390,844),('webkit',768,1024),('webkit',1366,768)]
MEASURE='''(selector)=>{const m=document.querySelector(selector);if(!m)return null;const r=m.getBoundingClientRect();const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};const input=m.querySelector('.term-giris');const vv=visualViewport;const top=vv?vv.offsetTop:0;const bottom=vv?vv.offsetTop+vv.height:innerHeight;return{box:box(m),input:input?box(input):null,inside:r.left>=-1&&r.right<=innerWidth+1&&r.top>=top-1&&r.bottom<=bottom+1,clipped:[...m.querySelectorAll('.term-baslik-cubugu button')].filter(e=>{const b=e.getBoundingClientRect();return b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1}).map(e=>e.title),input_ok:!!input&&input.getBoundingClientRect().width>=80&&input.getBoundingClientRect().right<=r.right+1&&input.getBoundingClientRect().bottom<=r.bottom+1,output_height:m.querySelector('.term-ekran').clientHeight,document_overflow:document.documentElement.scrollWidth>innerWidth+2}}'''
async def one(browser,engine,width,height):
 name=f'{engine}-{width}x{height}';row={'name':name,'checks':[],'commands':[],'page_errors':[],'console_errors':[],'failed_requests':[],'screenshots':[]}
 opts={'viewport':{'width':width,'height':height},'locale':'tr-TR','timezone_id':'Europe/Istanbul','has_touch':width<1000,'service_workers':'block'}
 if engine!='firefox':opts['is_mobile']=width<1000
 context=await browser.new_context(**opts)
 # Lokal test origin'i Cloudflare analitiğine rapor göndermez. Canlı testte bu stub yoktur.
 if args.base.startswith('http://127.0.0.1') or args.base.startswith('http://localhost'):
  async def local_telemetry(route):
   await route.fulfill(status=200,content_type='application/javascript',body='')
  await context.route('https://static.cloudflareinsights.com/**',local_telemetry)
  row['local_telemetry_stubbed']=True
 page=await context.new_page();page.set_default_timeout(6000)
 page.on('pageerror',lambda e:row['page_errors'].append(str(e)))
 page.on('console',lambda m:row['console_errors'].append(m.text[:500]) if m.type=='error' else None)
 page.on('requestfailed',lambda r:row['failed_requests'].append({'url':r.url.split('?')[0],'reason':r.failure}))
 def check(test,ok,detail=None):row['checks'].append({'test':test,'passed':bool(ok),'detail':detail})
 async def shot(label):
  file=OUT/f'{name}-{label}.png';await page.screenshot(path=str(file));row['screenshots'].append(str(file))
 async def command(text,prefix='term-modal'):
  screen=page.locator(f'#{prefix}-ekran');entry=page.locator(f'#{prefix}-giris');before=await screen.locator('.term-satir').count()
  await entry.fill(text);await entry.press('Enter');await page.wait_for_timeout(35)
  output='\n'.join((await screen.locator('.term-satir').all_text_contents())[before:]);row['commands'].append({'command':text,'output':output[:2500]});return output
 try:
  response=await page.goto(args.base,wait_until='domcontentloaded',timeout=40000)
  await page.wait_for_function("window.TentiforTerminal && typeof veri!=='undefined' && veri && typeof evrenSeciciListesi==='function'",timeout=30000)
  await page.wait_for_timeout(350)
  tour=page.get_by_role('button',name='Turu kapat',exact=True)
  if await tour.count() and await tour.is_visible():await tour.click()
  check('HTTP ve uygulama/veri başlangıcı',response.status==200)
  check('Ana sayfa yatay taşma yok',await page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  check('Alt menüyü kapatan FAB yok',await page.locator('#tentiforTermFab').count()==0)
  menu=page.locator('[data-mobil-menu]:visible')
  if await menu.count():
   await menu.first.click();await page.wait_for_timeout(100)
   check('Mobil menü gerçek dokunma/tıklamayla açılıyor',await page.locator('#mobilMenu').is_visible())
   close=page.locator('#mobilMenu .mobil-menu-kapat, #mobilMenu .mm-kapat, #mobilMenu [aria-label*="kapat" i]')
   if await close.count():await close.first.click()
   else:await page.keyboard.press('Escape')
   await page.wait_for_timeout(100)
   check('Mobil menü kapatılıyor',not await page.locator('#mobilMenu').is_visible())
  for route in ['tomye','okuma','oyunlar','fan','atolye']:
   await page.evaluate('(r)=>location.hash="#/"+r',route);await page.wait_for_timeout(100)
   check(f'{route}: yatay taşma yok',await page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  for alias in ['terminal','konsol']:
   await page.evaluate('(r)=>location.hash="#/"+r',alias)
   await page.locator('#tentifor-terminal-modal-kapsayici').wait_for(state='visible')
   check(f'{alias}: terminal URL rotası 404 üretmiyor',await page.locator('#yokSayfa').count()==0)
   await page.keyboard.press('Escape')
  await page.locator('#btnTerminalUst').click();modal=page.locator('#tentifor-terminal-modal-kapsayici');await modal.wait_for(state='visible');await page.wait_for_timeout(90)
  layout=await page.evaluate(MEASURE,'#tentifor-terminal-modal-kapsayici');row['terminal_layout']=layout
  check('Terminal ekrana sığıyor',layout['inside'],layout)
  check('Tüm başlık kontrolleri görünür',not layout['clipped'],layout['clipped'])
  check('Komut girişi kırpılmıyor ve kullanılabilir',layout['input_ok'],layout['input'])
  check('Çıktı alanı kullanılabilir yükseklikte',layout['output_height']>=40,layout['output_height'])
  for cmd,needle in [('yardim','TENTİFOR'),('takvim','Pzt Sal'),('isim çatlak','Gerdec'),('saat','Tömye'),('kyldo Tentifor','Kyldo'),('rotalar','#/okuma'),('admin durum','YETKİ'),('olmayan-komut','Komut bulunamadı')]:
   text=await command(cmd);check(f'Komut: {cmd}',needle.lower() in text.lower() and not re.search(r'(^|\n)Hata:',text),text[:300])
  text=await command('evren list');check('Gerçek katalog: Eterya ve canonical id', 'Eterya' in text and 'fornek-eterya' in text,text[:800])
  text=await command('evren bilgi eterya');check('Listelenen evrenin gerçek detayı bulunuyor','EVREN DETAYI' in text and 'bulunamadı' not in text,text[:800])
  text=await command('roman oku 1');allowed=await page.evaluate("bolumErisimi('roman')")
  check('Roman: gerçek veri veya doğru erişim kilidi','Roman kilitli' in text if not allowed else ('BÖLÜM 1' in text or 'kilitli' in text),text[:500])
  text=await command('karakter list');allowed=await page.evaluate("bolumErisimi('arsiv')")
  count=await page.evaluate('veri.karakterler.length')
  check('Karakter: gerçek kayıt sayısı veya doğru erişim kilidi',f'({count})' in text if allowed else 'kilitli' in text,text[:500])
  entry=page.locator('#term-modal-giris');await entry.click();check('Terminal girişine gerçek tıklama',await entry.evaluate('(e)=>document.activeElement===e'))
  await entry.press('ArrowUp');check('Geçmiş',await entry.input_value()=='karakter list')
  await entry.fill('ev');await entry.press('Tab');check('Tab tamamlama',await entry.input_value()=='evren ');await entry.fill('')
  await modal.locator('[data-term-aksiyon="tema"]').click();check('Tema ayarı','tema-amber' in (await modal.get_attribute('class')))
  await modal.locator('[data-term-aksiyon="crt"]').click();check('CRT ayarı','crt-aktif' in (await modal.get_attribute('class')))
  await modal.locator('[data-term-aksiyon="ses"]').click();check('Ses ayarı',await page.evaluate('!TentiforTerminal.ses.aktif'))
  if width in [320,390,1366]:await shot('terminal')
  await modal.locator('.term-baslik-sag [data-term-aksiyon="tamekran"]').click()
  fullscreen=await page.evaluate(MEASURE,'#tentifor-terminal-modal-kapsayici');check('Tam ekran ve başlık kontrolü',fullscreen['inside'] and not fullscreen['clipped'] and fullscreen['box']['width']>=width-1,fullscreen)
  await modal.locator('.term-baslik-sag [data-term-aksiyon="tamekran"]').click()
  if width<640:
   await page.set_viewport_size({'width':width,'height':360});await page.wait_for_timeout(100)
   small=await page.evaluate(MEASURE,'#tentifor-terminal-modal-kapsayici');check('Kısa ekran / viewport küçülmesi',small['inside'] and small['input_ok'] and not small['clipped'],small)
   await page.set_viewport_size({'width':height,'height':width});await page.wait_for_timeout(100)
   rotated=await page.evaluate(MEASURE,'#tentifor-terminal-modal-kapsayici');check('Ekran döndürme',rotated['inside'] and rotated['input_ok'] and not rotated['clipped'],rotated)
   await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(100)
  await modal.locator('.term-baslik-sag [data-term-aksiyon="kapat"]').click();check('Kapatma düğmesi',not await modal.is_visible())
  await page.keyboard.press('Alt+t');check('Klavye ile açma',await modal.is_visible())
  await page.keyboard.press('Escape');check('Escape ile kapatma',not await modal.is_visible())
  await page.evaluate("location.hash='#/tomyee'");await page.locator('#term-404-giris').wait_for(state='visible')
  await page.locator('#term-404-giris').click();check('404 komut girişine gerçek tıklama',await page.locator('#term-404-giris').evaluate('(e)=>document.activeElement===e'))
  text=await command('kurtar','term-404');check('Gerçek 404: doğru rota önerisi','#/tomye' in text,text[:600])
  check('404: tek gömülü terminal',await page.locator('.yok-terminal-kutusu').count()==1)
  await page.evaluate("dispatchEvent(new Event('hashchange'))");await page.wait_for_timeout(100)
  check('404: tekrar olayda çoğalmıyor',await page.locator('.yok-terminal-kutusu').count()==1)
  term404=page.locator('#term-404-konteyner');await term404.locator('.term-baslik-sag [data-term-aksiyon="tamekran"]').click()
  await page.wait_for_function("(()=>{const e=document.querySelector('#term-404-konteyner');return e?.classList.contains('tamekran')&&e.parentNode===document.body&&Math.abs(e.getBoundingClientRect().width-innerWidth)<2;})()")
  fs404=await page.evaluate(MEASURE,'#term-404-konteyner');check('404 gömülü terminal tam ekran',fs404['inside'] and fs404['box']['width']>=width-1,fs404)
  await term404.locator('.term-baslik-sag [data-term-aksiyon="tamekran"]').click()
  await page.wait_for_function("(()=>{const e=document.querySelector('#term-404-konteyner');return e&&!e.classList.contains('tamekran')&&Boolean(e.closest('#yokSayfa'));})()")
  if width in [320,390,1366]:await shot('404')
  await page.locator('#yokTerminalAc').click();check('404 sayfa terminal düğmesi',await modal.is_visible());await page.keyboard.press('Escape')
  await page.locator('#yokTermBuyutBtn').click();check('404ten tam terminale geçiş',await modal.is_visible());await page.keyboard.press('Escape')
  await page.evaluate("location.hash='#/oyunlar'");await page.wait_for_timeout(120);check('404ten geçerli rotaya dönüş',await page.locator('#yokSayfa').count()==0)
  await page.evaluate("location.hash='#/oyunlarr'");await page.locator('#term-404-giris').wait_for(state='visible')
  text=await command('kurtar','term-404');check('Yeni 404 adresinin doğru önerisi','#/oyunlar' in text)
  await page.evaluate("location.hash='#/arsiv'");await page.wait_for_timeout(120)
  await page.locator('#btnTerminalUst').click();text=await command('evren git eterya');await page.wait_for_timeout(180)
  route=await page.evaluate('rota()');check('Fan evrene gerçek rota ve panel ile gidiliyor',route=='#/ev/fan/fornek-eterya' and await page.locator('#evrenSayfa').count()>0,route)
  check('Yakalanmamış JavaScript hatası yok',not row['page_errors'],row['page_errors'])
 except Exception as e:
  row['error']=str(e);check('Tüm adımlar tamamlandı',False,str(e))
  try:await shot('hata')
  except Exception:pass
 row['passed']=sum(x['passed'] for x in row['checks']);row['failed']=len(row['checks'])-row['passed'];await context.close()
 print(json.dumps({'case':name,'passed':row['passed'],'failed':row['failed'],'error':row.get('error')},ensure_ascii=False),flush=True)
 return row
async def main():
 rows=[]
 async with async_playwright() as p:
  for engine in ['chromium','firefox','webkit']:
   launch={'headless':True}
   if engine=='chromium':launch.update(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
   browser=await getattr(p,engine).launch(**launch)
   sem=asyncio.Semaphore(3)
   async def limited(w,h):
    async with sem:return await one(browser,engine,w,h)
   rows.extend(await asyncio.gather(*(limited(w,h) for e,w,h in CASES if e==engine)))
   await browser.close()
 payload={'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':args.base,'cases':rows,'passed':sum(r['passed'] for r in rows),'failed':sum(r['failed'] for r in rows)}
 (OUT/'results.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
 print(f"Toplam {payload['passed']} başarılı, {payload['failed']} başarısız kontrol",flush=True)
 if payload['failed']:raise SystemExit(1)
asyncio.run(main())
