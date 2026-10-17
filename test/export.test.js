// Run: npm test   (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { ics, zip } = require('../index.js');

test('calendar export (.ics)', () => {
  const due = Date.UTC(2026, 8, 29, 19, 0);
  const text = ics.build([
    { key: 'assignment:42', title: 'Homework #16, part 2; final', course: 'CS 1020', due, url: 'https://canvas.example.edu/courses/1/assignments/42', share: 0.2 },
    { key: 'quiz:7', title: '第三章 测验 很长很长很长很长很长很长很长很长很长很长的标题', course: 'NET 3000', due: due + 864e5 }
  ], { now: Date.UTC(2026, 8, 25, 12), lang: 'zh', domain: 'canvas.example.edu' });
  const lines = text.split('\r\n');
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.strictEqual(lines.filter(l => l === 'BEGIN:VEVENT').length, 2);
  assert.ok(lines.includes('DTEND:20260929T190000Z'));
  assert.ok(lines.includes('DTSTART:20260929T183000Z'));
  assert.ok(lines.includes('SUMMARY:[CS 1020] Homework #16\\, part 2\\; final'));
  assert.ok(lines.includes('UID:assignment:42@canvas.example.edu'));
  assert.ok(text.replace(/\r\n /g, '').includes('占总成绩 0.2%'));
  assert.strictEqual(lines.filter(l => l.startsWith('TRIGGER;RELATED=END:')).length, 4);
  for (const l of lines) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.ok(text.replace(/\r\n /g, '').includes('第三章 测验 很长很长很长很长很长很长很长很长很长很长的标题'));
});

test('calendar export: your own product id, calendar name and footer', () => {
  const text = ics.build([{ key: 'a:1', title: 'Lab 1', due: Date.UTC(2026, 0, 5) }],
    { now: 0, prodId: '-//My App//EN', calName: 'My deadlines', footer: 'Exported by My App' });
  assert.match(text, /PRODID:-\/\/My App\/\/EN/);
  assert.match(text, /X-WR-CALNAME:My deadlines/);
  assert.match(text, /Exported by My App/);
  assert.doesNotMatch(ics.build([{ key: 'a:1', title: 'Lab 1', due: 0 }], { now: 0 }), /Exported by/);
});

test('calendar export: exams (dated events)', () => {
  const ev = ics.fromExams([
    { name: 'Midterm 1', date: '2026-10-14', time: '18:30', end_time: '20:00', location: 'Room 113', weight: '20%', notes: 'Ch. 1-5' },
    { name: 'Final', date: '2026-12-10', time: '', end_time: '' },
    { name: 'TBA quiz', date: '' }
  ], { courseId: '7', course: 'CS 1010', zh: true });
  assert.strictEqual(ev.length, 2);
  assert.strictEqual(new Date(ev[0].start).getHours(), 18);
  assert.strictEqual(ev[0].end - ev[0].start, 90 * 60e3);
  assert.ok(ev[1].allDay);
  const text = ics.build(ev, { now: 0, lang: 'zh', domain: 'example.edu' });
  assert.match(text, /SUMMARY:\[CS 1010\] Midterm 1/);
  assert.match(text, /LOCATION:Room 113/);
  assert.match(text, /DTSTART;VALUE=DATE:20261210/);
  assert.match(text, /DTEND;VALUE=DATE:20261211/);
  assert.match(text, /占比 20%/);
  assert.strictEqual((text.match(/BEGIN:VEVENT/g) || []).length, 2);
});

test('"Add to Google Calendar" links', () => {
  const [timed, allDay] = ics.fromExams([
    { name: 'Midterm 1', date: '2026-10-05', time: '18:30', end_time: '20:00', location: 'Room 113', weight: '20%' },
    { name: 'Final', date: '2026-12-10', time: '' }], { course: 'CS 1020', url: 'https://canvas.example.edu/courses/7' });
  const u = new URL(ics.googleUrl(timed));
  assert.strictEqual(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  assert.strictEqual(u.searchParams.get('text'), '[CS 1020] Midterm 1');
  assert.strictEqual(u.searchParams.get('location'), 'Room 113');
  assert.strictEqual(u.searchParams.get('dates'), `${ics.stamp(timed.start)}/${ics.stamp(timed.end)}`);
  assert.ok(/Weight: 20%/.test(u.searchParams.get('details')));
  const a = new URL(ics.googleUrl(allDay));
  assert.ok(/^20261210\/2026121[01]$/.test(a.searchParams.get('dates')) && !a.searchParams.has('location'));
});

test('zip: CRC-32 check value and a readable archive', async () => {
  assert.strictEqual(zip.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const a = new TextEncoder().encode('12345'), b = new TextEncoder().encode('6789');
  assert.strictEqual(zip.crc32(b, zip.crc32(a)), 0xCBF43926);
  const body = new TextEncoder().encode('hello');
  const blob = zip.build([{ name: '课程/01 第一周/讲义.pdf', data: body, date: new Date(2026, 8, 1, 10, 30) },
    { name: 'x/b.bin', data: new Blob([body]), crc: zip.crc32(body) }]);
  const u8 = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u8.buffer);
  assert.strictEqual(dv.getUint32(0, true), 0x04034b50);
  const eocd = u8.length - 22;
  assert.strictEqual(dv.getUint32(eocd, true), 0x06054b50);
  assert.strictEqual(dv.getUint16(eocd + 10, true), 2);
  const cd = dv.getUint32(eocd + 16, true);
  assert.strictEqual(dv.getUint32(cd, true), 0x02014b50);
  assert.strictEqual(dv.getUint16(cd + 8, true) & 0x0800, 0x0800);
  const n = dv.getUint16(cd + 28, true);
  assert.strictEqual(new TextDecoder().decode(u8.subarray(cd + 46, cd + 46 + n)), '课程/01 第一周/讲义.pdf');
});

test('zip: the archive opens with the system unzip', async () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  let has = true; try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch (e) { has = false; }
  if (!has) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cz-'));
  const blob = zip.build([{ name: 'week 1/notes.txt', data: new TextEncoder().encode('hi there') }]);
  fs.writeFileSync(path.join(dir, 'a.zip'), Buffer.from(await blob.arrayBuffer()));
  execFileSync('unzip', ['-q', 'a.zip'], { cwd: dir });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'week 1', 'notes.txt'), 'utf8'), 'hi there');
});
