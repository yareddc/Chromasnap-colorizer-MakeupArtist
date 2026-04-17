#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const SRC = path.resolve(process.cwd(), 'resources', 'icon-512.png');
const androidRes = path.resolve(process.cwd(), 'android', 'app', 'src', 'main', 'res');

const targets = [
  {dir: 'mipmap-mdpi', size: 48},
  {dir: 'mipmap-hdpi', size: 72},
  {dir: 'mipmap-xhdpi', size: 96},
  {dir: 'mipmap-xxhdpi', size: 144},
  {dir: 'mipmap-xxxhdpi', size: 192}
];

async function ensureDir(d){ try{ await fs.mkdir(d, {recursive:true}); }catch(e){} }

async function run(){
  try{
    await fs.access(SRC);
  }catch(e){
    console.error('Source icon not found:', SRC);
    console.error('Place your 512x512 PNG at resources/icon-512.png');
    process.exit(1);
  }

  for(const t of targets){
    const outDir = path.join(androidRes, t.dir);
    await ensureDir(outDir);
    const outPath = path.join(outDir, 'ic_launcher.png');
    const outRound = path.join(outDir, 'ic_launcher_round.png');
    const outForeground = path.join(outDir, 'ic_launcher_foreground.png');

    await sharp(SRC)
      .resize(t.size, t.size, {fit:'cover'})
      .png()
      .toFile(outPath);

    // copy same for round and foreground for now
    await fs.copyFile(outPath, outRound);
    await fs.copyFile(outPath, outForeground);

    console.log('Wrote', outPath);
  }

  // Play store icon (512x512)
  const playDir = path.join(process.cwd(), 'android', 'playstore');
  await ensureDir(playDir);
  const playOut = path.join(playDir, 'icon.png');
  await sharp(SRC).resize(512,512).png().toFile(playOut);
  console.log('Wrote Play Store icon', playOut);

  console.log('Android icon generation complete.');
}

run().catch(e=>{ console.error(e); process.exit(1); });
