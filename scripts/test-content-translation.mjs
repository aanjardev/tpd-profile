import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { editorPages } from '../src/cms/editor.ts';

const key = 'cms-test-only-translation-key';
const headingKey = 'Transportasi dan perjalanan di Bali';
const encode = text => text.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const output = text => `EN: ${text}`;

export async function createTranslationFixture() {
  const fixture = { key, mode:'success', calls:[], onRequest:undefined, delay:0 };
  const server = createServer(async (request, response) => {
    try {
      let text = ''; for await (const chunk of request) text += chunk;
      const body = JSON.parse(text);
      assert.equal(request.url, '/translate'); assert.equal(request.headers['x-goog-api-key'], key);
      assert.equal(body.source, 'id'); assert.equal(body.target, 'en'); assert.equal(body.format, 'text');
      assert.ok(body.q.length > 0 && body.q.length <= 128); assert.ok(body.q.join('').length <= 5000);
      fixture.calls.push(body.q);
      fixture.onRequest?.();
      if (fixture.delay) await new Promise(done => setTimeout(done, fixture.delay));
      if (fixture.mode === 'timeout') return;
      if (fixture.mode === 'network') { request.socket.destroy(); return; }
      if (typeof fixture.mode === 'number') { response.writeHead(fixture.mode); response.end(`Provider internal credentials: ${key}`); return; }
      if (fixture.mode === 'malformed') { response.end('{invalid json'); return; }
      let translations = body.q.map(text => ({ translatedText:encode(output(text)) }));
      if (fixture.mode === 'incomplete') translations.pop();
      if (fixture.mode === 'null') { response.end('null'); return; }
      if (fixture.mode === 'nonstring') translations[0].translatedText = 123;
      if (fixture.mode === 'empty') translations[0].translatedText = ' ';
      if (fixture.mode === 'long') translations[0].translatedText = 'x'.repeat(6000);
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ data:{ translations } }));
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise(done => server.listen(0,'127.0.0.1',done));
  fixture.origin = `http://127.0.0.1:${server.address().port}`;
  fixture.reset = () => { fixture.mode = 'success'; fixture.calls = []; fixture.onRequest = undefined; fixture.delay = 0; };
  fixture.close = async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); };
  return fixture;
}

const snapshot = content => ['id','en'].map(scope => content(scope));
function restore(db, rows) {
  const update = db.prepare('UPDATE content SET draft=?,published=?,version=?,updated_at=? WHERE scope=?');
  for (const row of rows) update.run(row.draft,row.published,row.version,row.updated_at,row.scope);
}

export async function testContentTranslation({ db, content, request, post, csrf, fixture, enable }) {
  const initial = snapshot(content), historyCount = db.prepare('SELECT COUNT(*) AS count FROM content_history').get().count;
  const path = page => `/admin/content/?scope=id&page=${page}`;
  const values = (extra={}) => ({ csrf, version:String(content('id').version), targetVersion:String(content('en').version), action:'translate', ...extra });
  try {
    let result = await request(path('home'),{admin:true});
    assert.match(result.html, /Terjemahan otomatis belum diaktifkan/);
    assert.match(result.html, /data-translate[^>]*disabled/);
    result = await post(path('home'),values({[`message:${headingKey}`]:'Sumber belum tersimpan'}));
    assert.match(result.html, /belum diaktifkan/); assert.deepEqual(snapshot(content),initial); assert.equal(fixture.calls.length,0);
    await enable();
    for (const scope of ['en','global']) {
      result = await post(`/admin/content/?scope=${scope}`,values());
      assert.match(result.html,/Terjemahan hanya tersedia/);
    }
    assert.equal((await post(path('home'),{...values(),csrf:''})).status,403);
    assert.equal((await post(path('home'),values(),true,{origin:'https://outside.example'})).status,403);
    assert.deepEqual(snapshot(content),initial);

    const before = snapshot(content), sourceHeading = "Transportasi & perjalanan <Bali> 'Siwride'";
    result = await post(path('home'),values({[`message:${headingKey}`]:sourceHeading,'message:Beranda':'Must stay fixed'}));
    assert.equal(result.status,303,result.html); assert.equal(result.response.headers.get('location'),'/admin/content/?scope=en&page=home&translated=1');
    const source = JSON.parse(content('id').draft), target = JSON.parse(content('en').draft), oldTarget = JSON.parse(before[1].draft);
    assert.equal(source.messages[headingKey],sourceHeading); assert.equal(target.messages[headingKey],output(sourceHeading));
    for (const field of editorPages[0].fields) assert.equal(target.messages[field.key],output(source.messages[field.key]));
    const homeKeys = new Set(editorPages[0].fields.map(field=>field.key));
    for (const [message,text] of Object.entries(oldTarget.messages)) if (!homeKeys.has(message)) assert.equal(target.messages[message],text);
    assert.deepEqual(target.services,oldTarget.services); assert.deepEqual(target.partners,oldTarget.partners); assert.deepEqual(target.steps,oldTarget.steps);
    for (let i=0;i<2;i++) { assert.equal(snapshot(content)[i].published,before[i].published); assert.equal(snapshot(content)[i].version,before[i].version+1); }
    assert.ok(!(await request('/')).html.includes('EN: Transportasi')); assert.ok(!(await request('/id/')).html.includes('Transportasi &amp; perjalanan &lt;Bali&gt;'));
    assert.ok((await request('/?preview=1',{admin:true})).html.includes('EN: Transportasi &amp; perjalanan &lt;Bali&gt;'));
    result = await request(result.response.headers.get('location'),{admin:true}); assert.match(result.html,/Website publik belum berubah/);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM content_history').get().count,historyCount);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit WHERE action='content.translate'").get().count,1);
    assert.ok(!(await request('/admin/',{admin:true})).html.includes('content.translate'));

    result = await post(path('services'),values({ 'item.title':'Nama tanpa deskripsi' }));
    assert.match(result.html,/Daftar maksimal 20 item|Judul dan deskripsi/);
    const serviceForm = new FormData(); for (const [name,value] of Object.entries(values())) serviceForm.set(name,value);
    for (const [title,description,icon] of [['Antar bandara','Layanan bandara Bali','plane'],['Tur & wisata','Perjalanan bersama mitra','compass']]) {
      serviceForm.append('item.title',title); serviceForm.append('item.description',description); serviceForm.append('item.icon',icon);
    }
    const targetHome = JSON.parse(content('en').draft).messages[headingKey];
    result = await post(path('services'),serviceForm); assert.equal(result.status,303,result.html);
    assert.deepEqual(JSON.parse(content('en').draft).services,[
      {number:'01',title:'EN: Antar bandara',description:'EN: Layanan bandara Bali',icon:'plane'},
      {number:'02',title:'EN: Tur & wisata',description:'EN: Perjalanan bersama mitra',icon:'compass'},
    ]);
    assert.equal(JSON.parse(content('en').draft).messages[headingKey],targetHome);
    const partnerForm = new FormData(); for (const [name,value] of Object.entries(values())) partnerForm.set(name,value);
    partnerForm.set('item.title','Mitra perjalanan'); partnerForm.set('item.description','Bekerja sama di Bali'); partnerForm.append('step','Hubungi kami'); partnerForm.append('step','Diskusikan kebutuhan');
    result = await post(path('partnership'),partnerForm); assert.equal(result.status,303,result.html);
    assert.deepEqual(JSON.parse(content('en').draft).partners,[{number:'01',title:'EN: Mitra perjalanan',description:'EN: Bekerja sama di Bali'}]);
    assert.deepEqual(JSON.parse(content('en').draft).steps,['EN: Hubungi kami','EN: Diskusikan kebutuhan']);
    fixture.reset(); const emptyServicesBefore = JSON.parse(content('en').draft);
    result = await post(path('services'),values()); assert.equal(result.status,303,result.html);
    assert.deepEqual(JSON.parse(content('en').draft).services,[]); assert.equal(fixture.calls.length,0);
    assert.deepEqual(JSON.parse(content('en').draft).partners,emptyServicesBefore.partners);

    fixture.reset(); const longValues = values();
    for (const field of editorPages[0].fields) longValues[`message:${field.key}`] = 'a'.repeat(field.short ? 290 : 4500);
    result = await post(path('home'),longValues); assert.equal(result.status,303,result.html); assert.ok(fixture.calls.length>1,'Long prose must be batched');

    for (const mode of [400,401,403,429,500,'network','malformed','null','incomplete','nonstring','empty','long','timeout']) {
      fixture.reset(); fixture.mode = mode; const stable = snapshot(content);
      result = await post(path('home'),values({[`message:${headingKey}`]:'Isian yang belum disimpan'}));
      assert.equal(result.status,200); assert.match(result.html,/class="notice error"/); assert.ok(!result.html.includes(key));
      assert.ok(result.html.includes('Isian yang belum disimpan')); assert.deepEqual(snapshot(content),stable,`Provider failure ${mode} must preserve both drafts`);
      if (mode === 'timeout') assert.match(result.html,/terlalu lama/);
    }
    fixture.reset(); fixture.onRequest = () => { if (fixture.calls.length===2) fixture.mode=500; };
    const partialBefore = snapshot(content); result = await post(path('home'),{...longValues,version:String(content('id').version),targetVersion:String(content('en').version)});
    assert.match(result.html,/class="notice error"/); assert.equal(fixture.calls.length,2); assert.deepEqual(snapshot(content),partialBefore);

    for (const locale of ['id','en']) {
      fixture.reset(); const stale = values(); db.prepare('UPDATE content SET version=version+1 WHERE scope=?').run(locale);
      const stable = snapshot(content); result = await post(path('home'),stale);
      assert.match(result.html,/diubah di tab lain/); assert.deepEqual(snapshot(content),stable); assert.equal(fixture.calls.length,0);
      fixture.reset(); const beforeWait = snapshot(content);
      fixture.onRequest = () => { fixture.onRequest=undefined; db.prepare('UPDATE content SET version=version+1 WHERE scope=?').run(locale); };
      result = await post(path('home'),values({[`message:${headingKey}`]:'Perubahan selama terjemahan'}));
      assert.match(result.html,/diubah di tab lain/);
      for (const row of beforeWait) { const current=content(row.scope); assert.equal(current.draft,row.draft); assert.equal(current.published,row.published); assert.equal(current.version,row.version+(row.scope===locale?1:0)); }
    }
    fixture.reset(); const rollbackBefore = snapshot(content);
    db.exec("CREATE TRIGGER test_translation_failure BEFORE UPDATE ON content WHEN NEW.scope='en' BEGIN SELECT RAISE(ABORT, 'Simulated translation save failure'); END");
    try { result=await post(path('home'),values({[`message:${headingKey}`]:'Rollback kedua bahasa'})); assert.match(result.html,/class="notice error"/); }
    finally { db.exec('DROP TRIGGER test_translation_failure'); }
    assert.deepEqual(snapshot(content),rollbackBefore,'The Indonesian write must roll back when the English write fails');

    fixture.reset(); result=await post(path('home'),values({[`message:${headingKey}`]:'Siap ditinjau'})); assert.equal(result.status,303,result.html);
    const idPublished=content('id').published;
    result=await post('/admin/content/?scope=en&page=home',{csrf,version:String(content('en').version),action:'publish'}); assert.equal(result.status,303,result.html);
    assert.ok((await request('/')).html.includes('EN: Siap ditinjau')); assert.equal(content('id').published,idPublished);
    result=await post(path('home'),{csrf,version:String(content('id').version),action:'publish'}); assert.equal(result.status,303,result.html);
    assert.ok((await request('/id/')).html.includes('Siap ditinjau'));
    console.log('PASS translation: server-only configuration, selected-page drafts, current form values, lists, batching, entities, private preview, manual publish, provider failures/timeouts, version conflicts and atomic rollback.');
  } finally { fixture.reset(); restore(db,initial); }
}

export async function testTranslationBrowser({ page, origin, content, db, fixture }) {
  const initial=snapshot(content), path=origin+'/admin/content/?scope=id&page=home';
  const button=()=>page.getByRole('button',{name:'Terjemahkan ke English',exact:true});
  try {
    fixture.reset(); fixture.delay=800;
    const manualEnglish=JSON.parse(content('en').draft); manualEnglish.messages[headingKey]='Manual English draft to review';
    db.prepare("UPDATE content SET draft=?,version=version+1 WHERE scope='en'").run(JSON.stringify(manualEnglish));
    await page.goto(path); await page.getByLabel('Judul utama',{exact:true}).fill('Konten Indonesia dari browser');
    // Existing English draft warning requires confirmation; cancel must preserve the unsaved source.
    assert.ok(await button().getAttribute('data-translate-confirm'));
    page.once('dialog',dialog=>dialog.dismiss()); await button().click();
    assert.equal(await page.getByLabel('Judul utama',{exact:true}).inputValue(),'Konten Indonesia dari browser'); assert.equal(fixture.calls.length,0);
    assert.equal(await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true}))),false,'Cancelling translation must preserve the unsaved-changes guard');
    if (await button().getAttribute('data-translate-confirm')) page.once('dialog',dialog=>dialog.accept());
    const click = button().click(); await page.getByText('Menerjemahkan dan menyimpan draft…',{exact:true}).waitFor();
    assert.equal(await page.locator('form[data-editor]').getAttribute('aria-busy'),'true');
    await click; await page.waitForURL('**scope=en&page=home&translated=1');
    assert.equal(await page.getByLabel('Judul utama',{exact:true}).inputValue(),'EN: Konten Indonesia dari browser');
    assert.ok((await page.locator('[role="status"]').textContent()).includes('Website publik belum berubah'));
    for (const row of initial) assert.equal(content(row.scope).published,row.published);
    await page.screenshot({path:'output/qa/content-translation-review-desktop.png',fullPage:true});
    await page.getByLabel('Judul utama',{exact:true}).fill('English reviewed by admin');
    await Promise.all([page.waitForURL('**saved=1'),page.getByRole('button',{name:'Terbitkan halaman',exact:true}).click()]);
    assert.equal(JSON.parse(content('en').published).messages[headingKey],'English reviewed by admin');
    assert.equal(content('id').published,initial[0].published);
    fixture.reset(); fixture.mode=429; await page.goto(path);
    await page.getByLabel('Judul utama',{exact:true}).fill('Sumber untuk dicoba kembali');
    if (await button().getAttribute('data-translate-confirm')) page.once('dialog',dialog=>dialog.accept());
    await button().click(); await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').textContent(),/Batas layanan/);
    assert.equal(await page.getByLabel('Judul utama',{exact:true}).inputValue(),'Sumber untuk dicoba kembali');
    assert.equal(await button().isEnabled(),true);
    assert.equal(await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true}))),false);
    fixture.reset();
    db.prepare("UPDATE content SET version=version+1 WHERE scope='en'").run();
    await button().click(); await page.getByRole('alert').getByRole('link',{name:/Muat ulang/}).waitFor();
    assert.match(await page.getByRole('alert').textContent(),/diubah di tab lain/); assert.equal(fixture.calls.length,0);
    assert.equal(await page.getByLabel('Judul utama',{exact:true}).inputValue(),'Sumber untuk dicoba kembali');
    // Clear the test's unsaved state before navigating for the viewport check.
    await page.locator('form[data-editor]').dispatchEvent('editor:saved');
    await page.setViewportSize({width:360,height:900}); await page.goto(path);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:'output/qa/content-translation-mobile.png',fullPage:true});
    console.log('PASS browser translation: overwrite/cancel, loading, English review, independent publication, recoverable provider error and mobile layout.');
  } finally { fixture.reset(); page.removeAllListeners('dialog'); restore(db,initial); await page.setViewportSize({width:1440,height:1000}); }
}
