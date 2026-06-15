import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env.local') });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const wavFile = process.argv[2] || path.join(__dirname, '..', 'myrecordings_20260615_105717_out_2B66985234928.wav');

if (!fs.existsSync(wavFile)) {
  console.error(`❌ File not found: ${wavFile}`);
  process.exit(1);
}

console.log(`🎙️  Transcribing: ${path.basename(wavFile)}\n`);

// Step 1: Transcribe with Whisper
const transcription = await client.audio.transcriptions.create({
  file: fs.createReadStream(wavFile),
  model: 'whisper-1',
  language: 'th',
  response_format: 'verbose_json',
});

const transcript = transcription.text;
const duration = transcription.duration;

console.log('📝 Transcript:');
console.log('─'.repeat(60));
console.log(transcript);
console.log('─'.repeat(60));
console.log(`⏱️  Duration: ${duration ? Math.round(duration) + 's' : 'N/A'}\n`);

// Step 2: Analyze with GPT-4o as telesales coach
console.log('🤖 Analyzing as telesales coach...\n');

const analysis = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: `You are an expert telesales coach for a Thai insurance/supplement company.
You analyze recorded sales calls and give actionable, specific feedback to help agents improve.
Always respond in Thai since the agents speak Thai.
Be direct, specific, and constructive — like a good coach, not a critic.`,
    },
    {
      role: 'user',
      content: `นี่คือ transcript ของการโทรขายประกัน/ผลิตภัณฑ์ของทีมเทเลเซลส์:

"""
${transcript}
"""

กรุณาวิเคราะห์การโทรนี้โดยครอบคลุมหัวข้อต่อไปนี้:

## 1. ภาพรวม
สรุปสั้นๆ ว่าสายนี้เป็นอย่างไร (ขายได้ / ไม่ได้ / ค้างไว้ และสาเหตุหลัก)

## 2. จุดแข็งที่ทำได้ดี
ระบุ 2-3 สิ่งที่ agent ทำได้ดีในสายนี้ พร้อมตัวอย่างจาก transcript

## 3. จุดที่ต้องปรับปรุง
ระบุ 2-3 สิ่งที่ต้องพัฒนา พร้อมตัวอย่างจาก transcript และวิธีที่ควรพูดแทน

## 4. การจัดการข้อโต้แย้ง (Objection Handling)
ลูกค้ามีข้อโต้แย้งอะไรบ้าง? Agent รับมืออย่างไร? ควรตอบอย่างไรให้ดีกว่านี้?

## 5. น้ำเสียงและการสื่อสาร
ประเมินน้ำเสียง ความมั่นใจ จังหวะการพูด และความชัดเจนของข้อความ

## 6. คะแนนรวม
ให้คะแนน 1-10 และเหตุผล

## 7. 3 สิ่งที่ต้องทำในสายต่อไป
Action items ที่ชัดเจน ทำได้ทันที`,
    },
  ],
  temperature: 0.4,
});

const feedback = analysis.choices[0].message.content;

console.log('📊 Coaching Feedback:');
console.log('═'.repeat(60));
console.log(feedback);
console.log('═'.repeat(60));
