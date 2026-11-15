import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { createTranslationFixture, testContentTranslation, testTranslationBrowser } from './test-content-translation.mjs';

const i18nOnly = process.argv.includes('--i18n');
const dir = await mkdtemp(join(tmpdir(),'tpd-cms-test-'));
const probe = createServer(); await new Promise(done => probe.listen(0,'127.0.0.1',done));
const port = probe.address().port; await new Promise(done => probe.close(done));
const origin = `http://127.0.0.1:${port}`, email = 'cms-test@example.test', password = randomBytes(20).toString('hex');
const translationFixture = await createTranslationFixture();
const env = { ...process.env, GOOGLE_TRANSLATE_API_KEY:'', CMS_TEST_TRANSLATION_ORIGIN:translationFixture.origin, CMS_DATA_DIR:dir, CMS_ORIGIN:origin, HOST:'127.0.0.1', PORT:String(port), ADMIN_EMAIL:email, ADMIN_NAME:'CMS Test', ADMIN_PASSWORD:password };
let server, db, serverLog = '', cookie = '', csrf = '';
const sleep = ms => new Promise(done => setTimeout(done,ms));
async function start() {
  server = spawn(process.execPath,['--import',pathToFileURL(resolve('scripts/helpers/mock-translation-fetch.mjs')).href,'dist/server/entry.mjs'],{ cwd:process.cwd(),env,stdio:['ignore','pipe','pipe'],windowsHide:true });
  server.stdout.on('data',chunk => serverLog += chunk); server.stderr.on('data',chunk => serverLog += chunk);
  for(let attempt=0;attempt<100;attempt++) {
    if(server.exitCode !== null) throw new Error(`Server stopped: ${serverLog}`);
    try { const response = await fetch(origin+'/admin/login/'); if(response.status === 200) return; } catch {}
    await sleep(100);
  }
  throw new Error(`Server did not start: ${serverLog}`);
}
async function stop() { if(server && server.exitCode === null) { const child=server; const exited=new Promise(done => child.once('exit',done)); child.kill(); await exited; } }
async function request(path, options={}) {
  const response = await fetch(origin+path,{ redirect:'manual',...options,headers:{ ...(options.admin ? { cookie } : {}),...options.headers } });
  const html = await response.text(); return { response,html,status:response.status };
}
async function post(path, values, authenticated=true, headers={}) {
  const body=values instanceof FormData ? values : new URLSearchParams(values);
  return request(path,{ method:'POST',body,admin:authenticated,headers:{ origin,...headers } });
}
const content = scope => db.prepare('SELECT * FROM content WHERE scope=?').get(scope);
const article = id => db.prepare('SELECT * FROM posts WHERE id=?').get(id);
const companyImageKeys = ['logo','hero','about'];
function companyForm(action='draft', version=content('global').version) {
  const form = new FormData(); form.set('csrf',csrf); form.set('version',String(version)); form.set('action',action);
  for(const [section,values] of Object.entries(JSON.parse(content('global').draft))) for(const [name,value] of Object.entries(values)) {
    if(section === 'visuals' && companyImageKeys.includes(name)) continue;
    form.set(`${section}.${name}`,String(value));
  }
  return form;
}
async function storedMedia() {
  return { rows:db.prepare('SELECT * FROM media ORDER BY id').all(), files:(await readdir(join(dir,'uploads'))).sort() };
}
async function authenticate(pass=password) {
  const result = await post('/admin/login/',{ email,password:pass },false);
  assert.equal(result.status,303,result.html);
  cookie=result.response.headers.get('set-cookie').split(';')[0];
  const dashboard=await request('/admin/',{ admin:true }); assert.equal(dashboard.status,200,dashboard.html);
  csrf=dashboard.html.match(/name="csrf" value="([^"]+)"/)?.[1]; assert.ok(csrf,'CSRF token missing');
}
async function savePost(id,group,data,action='draft',locale='id',translation='') {
  const row=article(id);
  const path=row ? `/admin/blog/${id}/` : `/admin/blog/new/?locale=${locale}${translation ? `&translate=${translation}` : ''}`;
  return post(path,{ csrf,id,group,version:String(row?.version || 0),...data,action });
}
try {
  await promisify(execFile)(process.execPath,['scripts/admin.mjs'],{ env,windowsHide:true });
  await start(); db=new DatabaseSync(join(dir,'content.sqlite'));

  const routes={ home:{en:'/',id:'/id/'},about:{en:'/about/',id:'/id/tentang/'},siwride:{en:'/siwride/',id:'/id/siwride/'},partnership:{en:'/partnership/',id:'/id/kemitraan/'},contact:{en:'/contact/',id:'/id/kontak/'},blog:{en:'/blog/',id:'/id/blog/'} };
  const {en,id:messagesId}=await import('../src/i18n/messages.ts'); assert.deepEqual(Object.keys(en).sort(),Object.keys(messagesId).sort());
  for(const translations of Object.values(routes)) for(const [locale,path] of Object.entries(translations)) {
    const result=await request(path); assert.equal(result.status,200,`${path}: ${result.html.slice(0,200)}`);
    assert.ok(result.html.includes(`<html lang="${locale}"`),path); assert.match(result.html,/name="robots" content="noindex, nofollow"/);
    const expectedOrigin=process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : '';
    for(const target of ['en','id']) assert.ok(result.html.includes(`hreflang="${target}" href="${expectedOrigin}${translations[target]}"`),`${path}: alternate ${target}`);
    for(const match of result.html.matchAll(/<a\b([^>]+)>/g)) {
      if(match[1].includes('data-language-link')) continue;
      const href=match[1].match(/href="([^"#]+)"/)?.[1];
      if(href?.startsWith('/') && !href.startsWith('/_astro')) assert.equal(href.startsWith('/id/'),locale==='id',`${path}: cross-language ${href}`);
    }
    for(const match of result.html.matchAll(/(?:href|src)="(\/(?:_astro|images|brand)\/[^"?#]+)"/g)) assert.equal((await fetch(origin+match[1])).status,200,`${path}: asset ${match[1]}`);
  }
  for(const [legacy,target] of [['tentang','tentang'],['kemitraan','kemitraan'],['kontak','kontak']]) {
    const result=await request(`/${legacy}/?campaign=bali&lang=id`); assert.ok([301,308].includes(result.status),`${legacy}: ${result.status}`); assert.equal(result.response.headers.get('location'),`/id/${target}/?campaign=bali&lang=id`);
  }
  for(const path of ['/missing/','/id/missing/','/blog/missing/','/id/blog/missing/']) {
    const result=await request(path); assert.equal(result.status,404,`${path}: ${result.status}`); assert.ok(result.html.includes(`<html lang="${path.startsWith('/id/')?'id':'en'}"`),`${path}: 404 locale`);
  }
  const switcher=(await readFile('src/components/LanguageSwitcher.astro','utf8')).match(/<script>([\s\S]*?)<\/script>/)[1].replace('querySelectorAll<HTMLAnchorElement>','querySelectorAll');
  const links=[{href:'https://example.test/blog/example/'},{href:'https://example.test/id/blog/contoh/'}],listeners={},location={search:'?campaign=bali',hash:'#layanan'};
  runInNewContext(switcher,{URL,location,document:{querySelectorAll:()=>links},window:{addEventListener:(event,callback)=>listeners[event]=callback}});
  assert.equal(links[1].href,'https://example.test/id/blog/contoh/?campaign=bali#layanan'); location.hash='#main-content'; listeners.hashchange(); assert.ok(links[0].href.endsWith('#main-content'));
  console.log('PASS i18n: 12 routes, assets, navigation, metadata, redirects, EN/ID 404 and switcher.');
  if(!i18nOnly) {
    assert.equal((await request('/admin/')).status,303);
    assert.notEqual((await request('/%61dmin/content/?scope=id')).status,200);
    assert.equal((await post('/admin/login/',{email,password},false,{origin:'https://outside.example'})).status,403);
    assert.match((await post('/admin/login/',{email,password:'invalid'},false)).html,/Email atau password/);
    await authenticate();
    for(const path of ['/admin/content/?scope=global','/admin/content/?scope=id','/admin/content/?scope=en&section=services','/admin/content/?scope=id&section=partners','/admin/blog/','/admin/blog/new/','/admin/categories/','/admin/media/','/admin/account/']) assert.equal((await request(path,{admin:true})).status,200,path);
    assert.equal((await post('/admin/categories/',{name_id:'A',name_en:'A'})).status,403);
    assert.equal((await post('/admin/categories/',{csrf,name_id:'A',name_en:'A'},true,{origin:'https://outside.example'})).status,403);
    const rawSession=cookie.split('=')[1]; assert.equal(db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE token_hash=?').get(rawSession).total,0);
    console.log('PASS authentication: protected routes, password verification, hashed sessions, origin and CSRF checks.');

    const heading='CMS draft heading <safe>',key='Transportasi dan perjalanan di Bali';
    let row=content('id');
    assert.equal((await post('/admin/content/?scope=id',{csrf,version:String(row.version),[`message:${key}`]:heading,action:'draft'})).status,303);
    assert.ok(!(await request('/id/')).html.includes('CMS draft heading'));
    assert.ok(!(await request('/id/?preview=1')).html.includes('CMS draft heading'));
    assert.ok((await request('/id/?preview=1',{admin:true})).html.includes('CMS draft heading &lt;safe&gt;'));
    row=content('id'); assert.equal((await post('/admin/content/?scope=id',{csrf,version:String(row.version),action:'publish'})).status,303);
    assert.ok((await request('/id/')).html.includes('CMS draft heading &lt;safe&gt;')); assert.ok(!(await request('/')).html.includes('CMS draft heading'));
    assert.match((await post('/admin/content/?scope=id',{csrf,version:'1',action:'publish'})).html,/diubah di tab lain/);
    row=content('id'); const history=db.prepare('SELECT id FROM content_history WHERE scope=? ORDER BY id DESC LIMIT 1').get('id');
    assert.equal((await post('/admin/content/?scope=id',{csrf,version:String(row.version),history:String(history.id),action:'restore'})).status,303);
    assert.ok((await request('/id/')).html.includes('CMS draft heading')); assert.ok(!(await request('/id/?preview=1',{admin:true})).html.includes('CMS draft heading'));
    row=content('id'); assert.equal((await post('/admin/content/?scope=id&section=services',{csrf,version:String(row.version),'item.title':'Layanan CMS','item.description':'Deskripsi CMS','item.icon':'plane',action:'publish'})).status,303);
    assert.ok((await request('/id/')).html.includes('Layanan CMS')); assert.ok((await request('/id/siwride/')).html.includes('Layanan CMS'));
    console.log('PASS company content: draft isolation, preview authorization, publish, history restore, shared services and stale-write protection.');

    const aboutKey='PT Tiga Pilar Dewata menghadirkan Siwride sebagai satu-satunya produk perusahaan, dengan fokus transportasi dan perjalanan di Bali.';
    const aboutDraft='About draft must stay private until its own publication.',homePath='/admin/content/?scope=id&page=home',aboutPath='/admin/content/?scope=id&page=about';
    const originalEnglish=content('en'),originalId=JSON.parse(content('id').draft),originalAboutPublished=JSON.parse(content('id').published).messages[aboutKey];
    assert.equal((await post(aboutPath,{csrf,version:String(content('id').version),[`message:${aboutKey}`]:aboutDraft,action:'draft'})).status,303);
    assert.equal((await post(homePath,{csrf,version:String(content('id').version),[`message:${key}`]:'Page scoped home heading','message:Beranda':'Must not rename navigation', [`message:${aboutKey}`]:'Must not edit another page',action:'publish'})).status,303);
    assert.equal(JSON.parse(content('id').draft).messages[aboutKey],aboutDraft);
    assert.equal(JSON.parse(content('id').published).messages[aboutKey],originalAboutPublished);
    assert.equal(JSON.parse(content('id').published).messages.Beranda,originalId.messages.Beranda);
    assert.ok((await request('/id/')).html.includes('Page scoped home heading'));
    assert.ok(!(await request('/id/tentang/')).html.includes(aboutDraft));
    const homeHistory=db.prepare('SELECT id FROM content_history WHERE scope=? ORDER BY id DESC LIMIT 1').get('id');
    assert.equal((await post(homePath,{csrf,version:String(content('id').version),history:String(homeHistory.id),action:'restore'})).status,303);
    assert.equal(JSON.parse(content('id').draft).messages[aboutKey],aboutDraft,'Restoring home must preserve the about draft');
    const homePublished=JSON.parse(content('id').published).messages[key];
    assert.equal((await post(aboutPath,{csrf,version:String(content('id').version),action:'publish'})).status,303);
    assert.equal(JSON.parse(content('id').published).messages[key],homePublished,'Publishing about must not publish the home draft');
    assert.ok((await request('/id/tentang/')).html.includes(aboutDraft));
    assert.deepEqual(content('en'),originalEnglish,'Editing Indonesian content must preserve English content');
    const simplified=(await request(homePath,{admin:true})).html;
    assert.ok(simplified.includes('Konten Website') && !simplified.includes('Konten Indonesia') && !simplified.includes('Konten English'));
    assert.ok(simplified.includes('Hero beranda') && simplified.includes('Tentang perusahaan') && simplified.includes('Layanan Siwride'));
    assert.ok(simplified.includes('data-image-upload="hero"') && simplified.includes('data-image-upload="about"'));
    assert.ok(!simplified.includes('Atur gambar section'));
    assert.ok(!simplified.includes('data-repeat-list="items"'),'Home must not duplicate the service list editor');
    assert.ok(!simplified.includes('name="message:Beranda"') && !simplified.includes('name="message:Hubungi Kami"'));
    assert.equal((simplified.match(/name="message:/g)||[]).length,7,'Home editor must expose all section fields once');
    const homePointKeys=['Fokus transportasi dan perjalanan','Siwride sebagai produk perusahaan','Kerja sama travel dan transportasi'];
    const aboutPointKeys=['Platform pemesanan kendaraan','Pengelolaan layanan bersama tim dan mitra','Fokus perjalanan di Bali'];
    for(const [path,sectionId,pointKeys,otherKeys,publicPath] of [[homePath,'about',homePointKeys,aboutPointKeys,'/id/'],[aboutPath,'profile',aboutPointKeys,homePointKeys,'/id/tentang/']]) {
      const editor=(await request(path,{admin:true})).html;
      const sectionHtml=editor.split(`id="content-section-${sectionId}"`)[1].split('</section>')[0];
      for(const pointKey of pointKeys) assert.ok(sectionHtml.includes(`name="message:${pointKey}"`),'Points must appear inside their public section');
      for(const pointKey of otherKeys) assert.ok(!editor.includes(`name="message:${pointKey}"`),'Other page points must not be duplicated');
      const before=content('id'),englishBefore=content('en'),pointKey=pointKeys[0],otherKey=otherKeys[0];
      const pointText=`Updated ${sectionId} point <safe>`,otherValue=JSON.parse(before.draft).messages[otherKey];
      assert.equal((await post(path,{csrf,version:String(before.version),action:'draft',[`message:${pointKey}`]:pointText,[`message:${otherKey}`]:'Must not change another page'})).status,303);
      assert.equal(JSON.parse(content('id').draft).messages[pointKey],pointText);
      assert.equal(JSON.parse(content('id').draft).messages[otherKey],otherValue);
      assert.equal(content('id').published,before.published,'Point drafts must remain private');
      assert.ok((await request(publicPath+'?preview=1',{admin:true})).html.includes(`Updated ${sectionId} point &lt;safe&gt;`));
      assert.equal((await post(path,{csrf,version:String(content('id').version),action:'publish'})).status,303);
      assert.ok((await request(publicPath)).html.includes(`Updated ${sectionId} point &lt;safe&gt;`));
      assert.deepEqual(content('en'),englishBefore,'Point edits must preserve English content');
      const stable=content('id');
      for(const invalid of ['', 'x'.repeat(301)]) {
        assert.match((await post(path,{csrf,version:String(stable.version),action:'draft',[`message:${pointKey}`]:invalid})).html,/Poin unggulan 1 wajib diisi/);
        assert.deepEqual(content('id'),stable,'Invalid points must not be saved');
      }
    }
    console.log('PASS highlighted points: correct sections, page isolation, draft preview, public publish, escaping and validation.');
    const sectionImage=await sharp({create:{width:20,height:20,channels:3,background:'#246b82'}}).png().toBuffer();
    const sectionForm=new FormData(); sectionForm.set('csrf',csrf); sectionForm.set('version',String(content('id').version)); sectionForm.set('action','draft'); sectionForm.set('image.hero',new File([sectionImage],'section-hero.png',{type:'image/png'}));
    assert.equal((await post(homePath,sectionForm)).status,303);
    const sectionHero=JSON.parse(content('global').draft).visuals.hero; assert.notEqual(sectionHero,'/images/bali-journey.webp');
    for(const pageId of ['home','about','siwride','services','partnership','contact']) for(const language of ['id','en']) assert.equal((await request(`/admin/content/?scope=${language}&page=${pageId}`,{admin:true})).status,200);
    console.log('PASS simplified content: editorial fields only, fixed navigation, page-scoped publish/restore, other drafts preserved, single content menu and both languages.');

    await testContentTranslation({ db, content, request, post, csrf, fixture:translationFixture, enable:async () => {
      await stop(); env.GOOGLE_TRANSLATE_API_KEY=translationFixture.key; await start();
    } });

    assert.equal((await post('/admin/categories/',{csrf,name_id:'Kabar Uji',name_en:'Test News',action:'save'})).status,303);
    const category=db.prepare('SELECT id FROM categories WHERE name_id=?').get('Kabar Uji').id;
    const postId=randomUUID(),group=randomUUID();
    const data={title:'Artikel uji CMS',slug:'artikel-uji-cms',excerpt:'Ringkasan artikel uji.',body:'## Judul isi\n\nArtikel **bermanfaat**.\n\n<script>alert("cms-xss")</script>\n\n[bahaya](javascript:alert(1))\n\n<img src=x onerror="alert(1)">',cover:'',coverAlt:'',categoryId:category,author:'Tim Uji',seoTitle:'SEO artikel uji',seoDescription:'Deskripsi SEO uji'};
    assert.equal((await savePost(postId,group,data)).status,303);
    assert.equal((await request('/id/blog/artikel-uji-cms/')).status,404);
    assert.equal((await request(`/id/blog/artikel-uji-cms/?preview=1&post=${postId}`)).status,404);
    let result=await request(`/id/blog/artikel-uji-cms/?preview=1&post=${postId}`,{admin:true}); assert.equal(result.status,200,result.html); assert.ok(result.html.includes('Artikel uji CMS')); assert.ok(!result.html.includes('onerror=')&&!result.html.includes('javascript:alert')&&!result.html.includes('<script>alert'));
    assert.equal((await savePost(postId,group,data,'publish')).status,303);
    result=await request('/id/blog/artikel-uji-cms/'); assert.equal(result.status,200,result.html); assert.ok(result.html.includes('SEO artikel uji')); assert.ok(result.html.includes('<h2>Judul isi</h2>')); assert.ok(result.html.includes('Kabar Uji')); assert.ok(!result.html.includes('hreflang="en" href='));
    assert.ok((await request('/id/blog/?q=artikel-uji-nomatch')).html.includes('Belum ada artikel.')); assert.ok((await request(`/id/blog/?category=${category}&q=Artikel`)).html.includes('Artikel uji CMS')); assert.ok((await request('/id/')).html.includes('Artikel uji CMS'));
    data.title='Judul baru CMS'; data.slug='artikel-diperbarui-cms';
    assert.equal((await savePost(postId,group,data)).status,303); assert.ok((await request('/id/blog/artikel-uji-cms/')).html.includes('Artikel uji CMS'));
    assert.equal((await savePost(postId,group,data,'publish')).status,303);
    result=await request('/id/blog/artikel-uji-cms/'); assert.equal(result.status,301,result.html); assert.equal(result.response.headers.get('location'),'/id/blog/artikel-diperbarui-cms/'); assert.equal((await request('/id/blog/artikel-diperbarui-cms/')).status,200);
    const collision=await savePost(randomUUID(),randomUUID(),data,'publish'); assert.equal(collision.status,200); assert.match(collision.html,/Slug sudah dipakai/);
    const articleUpload=await sharp({create:{width:20,height:20,channels:3,background:'#b38a35'}}).png().toBuffer(), orphanMedia=await storedMedia(), orphanForm=new FormData();
    orphanForm.set('csrf',csrf); orphanForm.set('id',randomUUID()); orphanForm.set('group',randomUUID()); orphanForm.set('version','0'); orphanForm.set('action','draft'); orphanForm.set('title','Artikel gagal'); orphanForm.set('slug','Slug Tidak Valid'); orphanForm.set('excerpt','Ringkasan'); orphanForm.set('body','Isi'); orphanForm.set('author','Penulis'); orphanForm.set('categoryId',''); orphanForm.set('cover',''); orphanForm.set('coverAlt',''); orphanForm.set('seoTitle',''); orphanForm.set('seoDescription',''); orphanForm.set('coverFile',new File([articleUpload],'orphan-cover.png',{type:'image/png'}));
    assert.match((await post('/admin/blog/new/?locale=id',orphanForm)).html,/Slug harus berupa/); assert.deepEqual(await storedMedia(),orphanMedia,'Failed article saves must remove uploaded covers');
    const enId=randomUUID(),english={...data,title:'CMS English article',slug:'cms-english-article',excerpt:'English excerpt',body:'English article.',cover:'/images/bali-journey.webp',coverAlt:'Illustrative Bali landscape'};
    assert.equal((await savePost(enId,group,english,'publish','en',postId)).status,303);
    result=await request('/id/blog/artikel-diperbarui-cms/'); assert.ok(result.html.includes('/blog/cms-english-article/')); assert.ok((await request('/blog/cms-english-article/')).html.includes('/id/blog/artikel-diperbarui-cms/'));
    assert.match((await post('/admin/categories/',{csrf,id:category,action:'delete'})).html,/masih dipakai/);
    assert.equal((await post(`/admin/blog/${postId}/`,{csrf,version:String(article(postId).version),action:'unpublish'})).status,303); assert.equal((await request('/id/blog/artikel-diperbarui-cms/')).status,404);
    assert.equal((await post('/admin/blog/',{csrf,id:postId,version:String(article(postId).version),action:'delete'})).status,303);
    assert.equal((await post('/admin/blog/',{csrf,id:postId,version:String(article(postId).version),action:'restore'})).status,303); assert.equal(article(postId).published,null); assert.equal(article(postId).deleted_at,null);
    console.log('PASS blog: create/edit/publish, draft isolation, XSS sanitation, search/category, translated URLs, slug redirects/collision, unpublish, trash and restore.');

    const image=await sharp({create:{width:20,height:20,channels:3,background:'#b38a35'}}).png().toBuffer();
    const upload=new FormData(); upload.set('csrf',csrf); upload.set('image',new File([image],'cms-test.png',{type:'image/png'}));
    assert.equal((await post('/admin/media/',upload)).status,303);
    const asset=db.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT 1').get(),assetUrl=`/media/${asset.filename}`;
    const mediaResponse=await fetch(origin+assetUrl); assert.equal(mediaResponse.status,200); assert.equal(mediaResponse.headers.get('content-type'),'image/webp');
    assert.equal((await sharp(Buffer.from(await mediaResponse.arrayBuffer())).metadata()).width,20);
    const invalid=new FormData(); invalid.set('csrf',csrf); invalid.set('image',new File(['<svg onload="alert(1)"></svg>'],'invalid.svg',{type:'image/svg+xml'})); assert.match((await post('/admin/media/',invalid)).html,/Gambar harus berupa/);
    console.log('PASS media library: raster validation, WebP conversion and persistent delivery.');

    const companyPath='/admin/content/?scope=global';
    const companyEditor=(await request(companyPath,{admin:true})).html;
    assert.ok(companyEditor.includes('name="image.logo"'));
    for(const key of ['hero','about']) assert.ok(!companyEditor.includes(`name="image.${key}"`),'Section images must be edited with their section');
    for(const key of companyImageKeys) assert.ok(!companyEditor.includes(`name="visuals.${key}"`),'Company image URLs must not be editable');
    assert.match(companyEditor,/enctype="multipart\/form-data"/);
    const originalVisuals=JSON.parse(content('global').draft).visuals,mediaBefore=await storedMedia();
    const unchanged=companyForm(); unchanged.set('visuals.logo','https://outside.example/ignored.png'); unchanged.set('image.hero',new File([],''));
    const unchangedResponse=await post(companyPath,unchanged);
    assert.equal(unchangedResponse.status,303,unchangedResponse.html.match(/role="alert">([^<]+)/)?.[1]);
    assert.deepEqual(JSON.parse(content('global').draft).visuals,originalVisuals);
    assert.deepEqual(await storedMedia(),mediaBefore);

    const single=companyForm(); single.set('image.logo',new File([image],'company-logo.png',{type:'image/png'}));
    assert.equal((await post(companyPath,single)).status,303);
    const draftLogo=JSON.parse(content('global').draft).visuals.logo;
    assert.notEqual(draftLogo,originalVisuals.logo); assert.equal(JSON.parse(content('global').draft).visuals.hero,originalVisuals.hero);
    assert.equal(JSON.parse(content('global').published).visuals.logo,originalVisuals.logo);
    for(const path of ['/','/id/']) {
      assert.ok(!(await request(path)).html.includes(draftLogo),'Draft image leaked to public');
      assert.ok((await request(path+'?preview=1',{admin:true})).html.includes(draftLogo),'Private preview missing draft image');
    }
    const savedEditor=(await request(companyPath,{admin:true})).html; assert.ok(savedEditor.includes(`data-current-src="${draftLogo}"`));
    const logoResponse=await fetch(origin+draftLogo); assert.equal(logoResponse.headers.get('content-type'),'image/webp');
    assert.equal((await sharp(Buffer.from(await logoResponse.arrayBuffer())).metadata()).width,20);
    assert.equal((await post(companyPath,companyForm('publish'))).status,303);
    for(const path of ['/','/id/']) assert.ok((await request(path)).html.includes(draftLogo));

    // A valid PNG with trailing padding exercises three full 5 MiB files in one request.
    const largeImage=Buffer.concat([image,Buffer.alloc(5*1024*1024-image.length)]),multiple=companyForm('publish');
    for(const key of companyImageKeys) multiple.set(`image.${key}`,new File([largeImage],`company-${key}.png`,{type:'image/png'}));
    assert.equal((await post(companyPath,multiple)).status,303,'Three 5 MiB images must fit in the company form');
    const publishedVisuals=JSON.parse(content('global').published).visuals;
    for(const key of companyImageKeys) {
      assert.notEqual(publishedVisuals[key],key === 'logo' ? draftLogo : originalVisuals[key]);
      assert.equal((await fetch(origin+publishedVisuals[key])).status,200);
    }
    for(const path of ['/','/id/']) for(const key of ['logo','hero']) assert.ok((await request(path)).html.includes(publishedVisuals[key]));
    for(const path of ['/about/','/id/tentang/']) assert.ok((await request(path)).html.includes(publishedVisuals.about));
    const previousLogo=db.prepare('SELECT * FROM media WHERE filename=?').get(draftLogo.split('/').at(-1));
    assert.ok(previousLogo,'Previous image must stay in the media library'); assert.equal((await fetch(origin+draftLogo)).status,200);
    assert.match((await post('/admin/media/',{csrf,id:previousLogo.id,action:'delete'})).html,/masih digunakan/);
    console.log('PASS company images: multipart uploads, current preview, preserved images, draft isolation, EN/ID publish, three 5 MiB files and history protection.');

    const stableContent=content('global'),stableMedia=await storedMedia();
    const rejected=companyForm('publish'); rejected.set('company.name','Must not be saved');
    rejected.set('image.logo',new File([image],'discard-logo.png',{type:'image/png'}));
    rejected.set('image.hero',new File(['not an image'],'corrupt.png',{type:'image/png'}));
    const rejectedResponse=await post(companyPath,rejected);
    assert.match(rejectedResponse.html,/Gambar hero beranda: Gambar harus berupa/); assert.match(rejectedResponse.html,/Pilih ulang file/);
    assert.ok(rejectedResponse.html.includes(`data-current-src="${publishedVisuals.logo}"`));
    assert.deepEqual(content('global'),stableContent); assert.deepEqual(await storedMedia(),stableMedia,'Partial uploads must be removed');
    const tooLarge=companyForm(); tooLarge.set('image.about',new File([Buffer.alloc(5*1024*1024+1)],'large.png',{type:'image/png'}));
    assert.match((await post(companyPath,tooLarge)).html,/Gambar tentang perusahaan: Ukuran gambar maksimal 5 MB/);
    const emptyImage=companyForm(); emptyImage.set('image.logo',new File([],'empty.png',{type:'image/png'}));
    assert.match((await post(companyPath,emptyImage)).html,/Ukuran gambar maksimal 5 MB/);
    const stale=companyForm('publish',stableContent.version-1); stale.set('image.logo',new File([image],'stale.png',{type:'image/png'}));
    assert.match((await post(companyPath,stale)).html,/diubah di tab lain/);
    const missingCsrf=companyForm(); missingCsrf.delete('csrf'); missingCsrf.set('image.logo',new File([image],'no-csrf.png',{type:'image/png'}));
    assert.equal((await post(companyPath,missingCsrf)).status,403);
    assert.equal((await post(companyPath,companyForm(),true,{origin:'https://outside.example'})).status,403);
    const oversized=companyForm(); oversized.set('image.logo',new File([Buffer.alloc(16*1024*1024)],'request-too-large.png',{type:'image/png'}));
    assert.equal((await post(companyPath,oversized)).status,413);
    const libraryOversized=new FormData(); libraryOversized.set('csrf',csrf); libraryOversized.set('image',new File([Buffer.alloc(6*1024*1024)],'library-too-large.png',{type:'image/png'}));
    assert.equal((await post('/admin/media/',libraryOversized)).status,413,'Other routes must retain the 6 MiB request limit');
    assert.deepEqual(content('global'),stableContent); assert.deepEqual(await storedMedia(),stableMedia);

    // Force a database save failure after two successful uploads, without touching real CMS data.
    db.exec("CREATE TRIGGER test_content_save_failure BEFORE UPDATE ON content WHEN NEW.scope='global' BEGIN SELECT RAISE(ABORT,'Simulated content save failure'); END");
    try {
      const failing=companyForm('publish');
      for(const key of ['logo','hero']) failing.set(`image.${key}`,new File([image],`discard-${key}.png`,{type:'image/png'}));
      assert.match((await post(companyPath,failing)).html,/Simulated content save failure/);
    } finally { db.exec('DROP TRIGGER test_content_save_failure'); }
    assert.deepEqual(content('global'),stableContent); assert.deepEqual(await storedMedia(),stableMedia,'Save failures must remove every new upload');
    // Simulate another writer changing the version while image processing is awaited.
    db.exec("CREATE TRIGGER test_content_upload_conflict AFTER INSERT ON media BEGIN UPDATE content SET version=version+1 WHERE scope='global'; END");
    try {
      const conflicting=companyForm('publish'); conflicting.set('image.logo',new File([image],'conflict.png',{type:'image/png'}));
      assert.match((await post(companyPath,conflicting)).html,/diubah di tab lain/);
    } finally { db.exec('DROP TRIGGER test_content_upload_conflict'); }
    assert.equal(content('global').version,stableContent.version+1);
    assert.equal(content('global').draft,stableContent.draft); assert.equal(content('global').published,stableContent.published);
    assert.deepEqual(await storedMedia(),stableMedia,'Late conflicts must remove newly uploaded images');
    console.log('PASS company image failures: invalid/empty/oversized files, request limits, CSRF/origin, stale forms, partial uploads, failed saves and conflicts during upload.');

    const newPassword=randomBytes(20).toString('hex');
    assert.equal((await post('/admin/account/',{csrf,current:password,password:newPassword,confirm:newPassword})).status,303);
    assert.equal((await request('/admin/',{admin:true})).status,303); await authenticate(newPassword);
    await stop(); await start();
    assert.equal((await request('/blog/cms-english-article/')).status,200); assert.equal((await fetch(origin+assetUrl)).status,200); assert.equal((await request('/admin/',{admin:true})).status,200);
    for(let index=0;index<9;index++) assert.equal((await savePost(randomUUID(),randomUUID(),{...english,title:`Pagination article ${index}`,slug:`pagination-article-${index}`},'publish','en')).status,303);
    assert.equal(((await request('/blog/')).html.match(/class="blog-card"/g)||[]).length,9);
    assert.equal(((await request('/blog/?page=2')).html.match(/class="blog-card"/g)||[]).length,1);
    assert.equal((await request('/blog/?page=3')).status,404);
    console.log('PASS pagination: nine articles on the first page, remaining articles on the second page.');
    const filteredArticles=await request('/admin/blog/?q=CMS%20English&locale=en&status=published',{admin:true});
    assert.ok(filteredArticles.html.includes('CMS English article') && !filteredArticles.html.includes('Pagination article 0'));
    assert.ok(!filteredArticles.html.includes('class="page-heading"') && !filteredArticles.html.includes('<h2>Daftar artikel'));
    const emptyArticles=await request('/admin/blog/?q=no-matching-admin-title',{admin:true});
    assert.ok(emptyArticles.html.includes('<table>') && emptyArticles.html.includes('Belum ada artikel yang cocok.'));
    if(process.argv.includes('--browser')) {
      const {chromium}=await import('@playwright/test');
      const browser=await chromium.launch({channel:'chrome',headless:true});
      try {
        const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await mkdir('output/qa',{recursive:true});
        await page.goto(origin+'/admin/login/'); await page.getByLabel('Email',{exact:true}).fill(email); await page.getByLabel('Password',{exact:true}).fill(newPassword);
        await Promise.all([page.waitForURL('**/admin/'),page.getByRole('button',{name:'Masuk ke admin'}).click()]);
        await page.screenshot({path:'output/qa/admin-dashboard-desktop.png',fullPage:true});
        await page.goto(origin+companyPath);
        assert.equal(await page.locator('[data-image-upload]').count(),1);
        const logoField=page.locator('[data-image-upload="logo"]'),logoInput=logoField.locator('input[type="file"]'),logoPreview=logoField.locator('[data-image-preview]'),logoStatus=logoField.locator('[data-image-status]');
        const initialLogo=await logoPreview.getAttribute('src'),browserMediaBefore=await storedMedia();
        assert.equal(initialLogo,publishedVisuals.logo);
        assert.ok(await logoPreview.evaluate(async img => { await img.decode(); return img.naturalWidth>0; }));
        assert.equal(await logoField.getByRole('button',{name:'Batalkan penggantian'}).isVisible(),false);
        const browserImage={name:'browser-logo.png',mimeType:'image/png',buffer:image};
        await logoInput.setInputFiles(browserImage);
        assert.match(await logoPreview.getAttribute('src'),/^blob:/); assert.match(await logoStatus.textContent(),/Belum disimpan/);
        assert.ok(await logoPreview.evaluate(async img => { await img.decode(); return img.naturalWidth===20; }));
        assert.deepEqual(await storedMedia(),browserMediaBefore,'Choosing a file must not upload it');
        await logoField.getByRole('button',{name:'Batalkan penggantian'}).click();
        assert.equal(await logoPreview.getAttribute('src'),initialLogo); assert.equal(await logoInput.evaluate(input=>input.files.length),0);
        assert.equal(await logoStatus.textContent(),'Gambar tersimpan');
        await logoInput.setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
        assert.match(await logoStatus.textContent(),/maksimal 5 MB/); assert.equal(await logoInput.evaluate(input=>input.files.length),0);
        assert.equal(await logoPreview.getAttribute('src'),initialLogo);
        await logoInput.setInputFiles(browserImage);
        await page.screenshot({path:'output/qa/company-images-preview-desktop.png',fullPage:true});
        await Promise.all([page.waitForURL('**saved=1'),page.getByRole('button',{name:'Simpan draft',exact:true}).click()]);
        const browserDraftLogo=JSON.parse(content('global').draft).visuals.logo;
        assert.notEqual(browserDraftLogo,initialLogo);
        assert.equal(await logoPreview.getAttribute('src'),browserDraftLogo); assert.equal(await logoStatus.textContent(),'Gambar tersimpan');
        assert.equal(JSON.parse(content('global').published).visuals.logo,initialLogo);
        await page.goto(origin+companyPath);
        await Promise.all([page.waitForURL('**saved=1'),page.getByRole('button',{name:'Terbitkan identitas & kontak',exact:true}).click()]);
        for(const path of ['/','/id/']) assert.ok((await request(path)).html.includes(browserDraftLogo));
        assert.deepEqual(JSON.parse(content('global').published).visuals,JSON.parse(content('global').draft).visuals);
        console.log('PASS browser company images: loaded current image, local preview, cancel, size validation, no early upload, draft save and EN/ID publish.');
        await page.goto(origin+homePath);
        assert.equal(await page.getByRole('textbox').filter({visible:true}).count(),4);
        assert.equal(await page.getByRole('link',{name:/Konten Website/}).count(),1);
        await page.getByLabel('Halaman',{exact:true}).selectOption('about');
        await Promise.all([page.waitForURL('**page=about'),page.getByRole('button',{name:'Buka',exact:true}).click()]);
        assert.equal(await page.getByRole('textbox').filter({visible:true}).count(),2);
        await Promise.all([page.waitForURL('**scope=en&page=about'),page.getByRole('navigation',{name:'Bahasa konten'}).getByRole('link',{name:'English',exact:true}).click()]);
        assert.equal(await page.getByLabel('Halaman',{exact:true}).inputValue(),'about');
        assert.equal(await page.getByRole('link',{name:/Konten Website/}).getAttribute('aria-current'),'page');
        await page.screenshot({path:'output/qa/content-editor-simple-desktop.png',fullPage:true});
        await testTranslationBrowser({ page, origin, content, db, fixture:translationFixture });
        await page.goto(origin+'/admin/blog/');
        assert.equal(await page.locator('.page-heading').count(),0);
        const toolbarRows=await page.locator('.blog-toolbar').evaluate(form => [...form.children].map(child=>{ const rect=child.getBoundingClientRect(); return Math.round(rect.top+rect.height/2); }));
        assert.equal(new Set(toolbarRows).size,1,'Search, filters and add action must share one row');
        await page.getByRole('searchbox',{name:'Cari judul artikel'}).fill('CMS English');
        await page.getByRole('combobox',{name:'Bahasa',exact:true}).selectOption('en');
        await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('published');
        await Promise.all([page.waitForURL('**status=published'),page.getByRole('button',{name:'Terapkan',exact:true}).click()]);
        assert.equal(await page.locator('tbody tr').count(),1);
        assert.equal(await page.locator('tbody tr a').first().textContent(),'CMS English article');
        await page.screenshot({path:'output/qa/admin-blog-table-desktop.png',fullPage:true});
        await page.goto(origin+'/admin/content/?scope=id&section=services');
        await page.getByRole('button',{name:'+ Tambah item',exact:true}).click();
        const added=page.locator('.repeat-item').last(); await added.locator('[name="item.title"]').fill('Browser draft service'); await added.locator('[name="item.description"]').fill('Service added through the admin interface.');
        await added.getByRole('button',{name:'Naikkan item'}).click();
        await Promise.all([page.waitForURL('**saved=1'),page.getByRole('button',{name:'Simpan draft',exact:true}).click()]);
        assert.ok(!(await request('/id/')).html.includes('Browser draft service'));
        const previewHref=await page.getByRole('link',{name:'Pratinjau draft tersimpan'}).getAttribute('href');
        const preview=await context.request.get(origin+previewHref); assert.ok((await preview.text()).includes('Browser draft service'));
        await page.goto(origin+`/admin/blog/${enId}/`); await page.locator('#post-body').fill(''); await page.getByRole('button',{name:'Terbitkan perubahan',exact:true}).click(); assert.match(await page.locator('#post-body').evaluate(element => element.validationMessage),/Isi artikel wajib/); await page.locator('#post-body').fill('Browser article **preview**.');
        await page.getByRole('button',{name:'Pratinjau isi',exact:true}).click(); await page.locator('#markdown-preview strong').waitFor();
        assert.equal(await page.locator('#markdown-preview strong').textContent(),'preview');
        await Promise.all([page.waitForURL('**saved=1'),page.getByRole('button',{name:'Simpan draft',exact:true}).click()]);
        for(const width of [360,768,1440]) for(const path of ['/admin/', companyPath, '/admin/content/?scope=id', '/admin/content/?scope=en&page=about', '/admin/content/?scope=id&page=services', '/admin/content/?scope=id&page=partnership', '/admin/blog/','/admin/blog/'+enId+'/', '/admin/media/','/blog/','/blog/cms-english-article/']) {
          await page.setViewportSize({width,height:900}); await page.goto(origin+path); await page.waitForLoadState('networkidle');
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow ${width}: ${path}`);
        }
        await page.setViewportSize({width:360,height:900}); await page.goto(origin+homePath); await page.screenshot({path:'output/qa/content-editor-simple-mobile.png',fullPage:true});
        await page.goto(origin+'/admin/blog/'); await page.screenshot({path:'output/qa/admin-blog-table-mobile.png',fullPage:true});
        await page.setViewportSize({width:360,height:900}); await page.goto(origin+companyPath); await page.screenshot({path:'output/qa/company-images-mobile.png',fullPage:true});
        await page.setViewportSize({width:360,height:900}); await page.goto(origin+`/admin/blog/${enId}/`); await page.screenshot({path:'output/qa/admin-editor-mobile.png',fullPage:true});
        await page.goto(origin+'/blog/cms-english-article/'); await page.screenshot({path:'output/qa/blog-article-mobile.png',fullPage:true});
        await page.setViewportSize({width:1440,height:1000}); await page.goto(origin+'/blog/'); await page.screenshot({path:'output/qa/blog-list-desktop.png',fullPage:true});
        assert.deepEqual(errors,[],'Browser JavaScript errors');
        await context.close(); console.log('PASS browser: login, add/reorder/save service, private preview, article toolbar preview, and no overflow at 360/768/1440px. Screenshots in output/qa/.');
      } finally { await browser.close(); }
    }
    assert.equal((await post('/admin/logout/',{csrf})).status,303); assert.equal((await request('/admin/',{admin:true})).status,303);
    console.log('PASS account/persistence: password change revokes sessions, logout, content, articles, media and sessions survive server restart.');
    if(process.env.SITE_URL?.startsWith('https://')) {
      await stop(); const publicUrl=new URL(process.env.SITE_URL); env.CMS_ORIGIN=publicUrl.origin; await start();
      const proxyHeaders={host:publicUrl.host,'x-forwarded-host':publicUrl.host,'x-forwarded-proto':'https','x-forwarded-port':publicUrl.port || '443',origin:publicUrl.origin};
      const proxied=await request('/admin/login/',{method:'POST',body:new URLSearchParams({email,password:newPassword}),headers:proxyHeaders});
      assert.equal(proxied.status,303,proxied.html); assert.match(proxied.response.headers.get('set-cookie'),/Secure/);
      assert.equal((await request('/admin/login/',{method:'POST',body:new URLSearchParams({email,password:newPassword}),headers:{...proxyHeaders,origin:'https://outside.example'}})).status,403);
      console.log('PASS HTTPS reverse proxy: configured Host and forwarded HTTPS origin accept login, set Secure cookies and reject a different origin.');
    }
  }
  assert.ok(!serverLog.includes('ResponseSentError'),serverLog);
  console.log(i18nOnly ? 'All i18n checks passed.' : 'All CMS integration checks passed. Test data was isolated from the local website.');
} catch(error) { console.error(error); console.error(serverLog.slice(-9000)); process.exitCode=1; }
finally {
  db?.close(); await stop();
  await translationFixture.close();
  const absolute=resolve(dir),root=resolve(tmpdir());
  if(!absolute.startsWith(root+sep)||!absolute.split(sep).at(-1).startsWith('tpd-cms-test-')) throw new Error('Unexpected test cleanup path');
  await rm(absolute,{recursive:true,force:true});
}
