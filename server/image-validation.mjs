import {createHash} from 'node:crypto';
import {fail} from './http-utils.mjs';
export function inspectRaster(data,{maxBytes=30*1024*1024,maxPixels=24_000_000}={}) {
  if(typeof data!=='string')fail(422,'An owned raster image is required.');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if(!match||match[2].length>Math.ceil(maxBytes/3)*4)fail(422,'Images must be PNG, JPEG or WebP, no larger than 30 MiB.');
  const bytes=Buffer.from(match[2],'base64');if(bytes.length>maxBytes)fail(422,'Image transport limit exceeded.');
  let width,height;const mime='image/'+match[1];
  if(match[1]==='png') {
    if(bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')fail(422,'Invalid PNG header.');
    width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
  }else if(match[1]==='jpeg') {
    if(bytes.length<12||bytes[0]!==255||bytes[1]!==216)fail(422,'Invalid JPEG header.');
    let i=2;
    while(i+4<=bytes.length) {
      if(bytes[i]!==255){i++;continue;}while(bytes[i]===255)i++;const marker=bytes[i++];
      if(marker===0xD9||marker===0xDA)break;if(marker===0x01||(marker>=0xD0&&marker<=0xD7))continue;
      if(i+2>bytes.length)break;const length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)break;
      if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)&&length>=8){height=bytes.readUInt16BE(i+3);width=bytes.readUInt16BE(i+5);break;}i+=length;
    }
  }else {
    if(bytes.length<30||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')fail(422,'Invalid WebP header.');
    const format=bytes.toString('ascii',12,16);
    if(format==='VP8X'){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);if(bytes[20]&2)fail(422,'Animated WebP is not supported. Export a still frame.');}
    else if(format==='VP8 '){width=bytes.readUInt16LE(26)&0x3FFF;height=bytes.readUInt16LE(28)&0x3FFF;}
    else if(format==='VP8L'&&bytes[20]===0x2F){const bits=bytes.readUInt32LE(21);width=(bits&0x3FFF)+1;height=((bits>>>14)&0x3FFF)+1;}
  }
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>maxPixels)fail(422,'Image dimensions are invalid or exceed the 24-megapixel decode budget. Export a smaller still image.');
  return {mime,width,height,bytes:bytes.length,hash:createHash('sha256').update(data).digest('hex')};
}
