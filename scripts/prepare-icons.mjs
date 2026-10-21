import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const source = 'docs/assets/symbol-source.png';
const image = await sharp(source).metadata();
console.log('Source', {width:image.width,height:image.height,alpha:image.hasAlpha});
await sharp(source).resize(512,512,{fit:'contain',background:'#00000000'}).png().toFile('public/brand/symbol.png');
for (const size of [16,32,48,180,192]) {
  await sharp(source).resize(size,size,{fit:'contain',background:'#00000000'}).png().toFile(`public/brand/${size===180?'apple-touch-icon':`icon-${size}`}.png`);
}
const sizes=[16,32,48];
const buffers=await Promise.all(sizes.map(size=>sharp(`public/brand/icon-${size}.png`).toBuffer()));
const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
sizes.forEach((size,i)=>{const at=6+i*16;header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(buffers[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=buffers[i].length;});
await writeFile('public/favicon.ico',Buffer.concat([header,...buffers]));
