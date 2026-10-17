/*!
 * canvas-export — calendar (.ics) and .zip exports from the browser, from Canvas+ (https://getcanvasplus.com)
 * Copyright (c) 2026 Baowen Liu. MIT License.
 */
// Two small, dependency-free helpers:
//   ics — Canvas deadlines and exams -> an .ics file (Google / Apple Calendar, Outlook) or an "Add to Google Calendar" link
//   zip — many files -> one .zip, built in the browser (stored, no compression; UTF-8 names; Blobs streamed, not copied)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CanvasExport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const NS = {};

  (function (NS) {
    // UTC timestamp in iCalendar form: 20260929T190000Z
    const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    // Text values must escape backslash, semicolon, comma and newlines.
    const esc = s => String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

    // Fold lines at 75 bytes without splitting multi-byte characters.
    function fold(line) {
      const out = [];
      let cur = '', bytes = 0;
      for (const ch of line) {
        const b = new TextEncoder().encode(ch).length;
        if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
        cur += ch; bytes += b;
      }
      out.push(cur);
      return out.join('\r\n ');
    }

    // items: [{ key, title, course, due, url, share }] -> .ics text.
    function build(items, { now = Date.now(), lang = 'en', domain = 'canvas-export', prodId = '-//canvas-export//Deadlines//EN', calName, footer = '' } = {}) {
      const zh = lang === 'zh';
      const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:' + prodId, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'X-WR-CALNAME:' + esc(calName || (zh ? 'Canvas 截止时间' : 'Canvas deadlines'))
      ];
      for (const it of items) {
        if (it.start != null) { lines.push(...eventLines(it, now, zh, domain, footer)); continue; }
        const share = it.share > 0 ? (it.share < 0.1 ? '<0.1' : it.share < 10 ? it.share.toFixed(1).replace(/\.0$/, '') : it.share.toFixed(0)) : '';
        const summary = `${it.course ? `[${it.course}] ` : ''}${it.title}`;
        const desc = [
          zh ? '截止时间（这个日程的结束时间）' : 'Due at the end of this event',
          share ? (zh ? `占总成绩 ${share}%` : `${share}% of your final grade`) : null,
          it.url || null,
          footer || null
        ].filter(Boolean).join('\n');
        lines.push('BEGIN:VEVENT',
          'UID:' + esc(String(it.key).replace(/[^\w:.-]/g, '_')) + '@' + domain,
          'DTSTAMP:' + stamp(now),
          'DTSTART:' + stamp(it.due - 30 * 60e3),
          'DTEND:' + stamp(it.due),
          'SUMMARY:' + esc(summary),
          'DESCRIPTION:' + esc(desc));
        if (it.url) lines.push('URL:' + it.url);
        for (const [trigger, label] of [['-P1D', zh ? '明天截止' : 'Due tomorrow'], ['-PT2H', zh ? '2 小时后截止' : 'Due in 2 hours']]) {
          lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(`${label}: ${summary}`),
            'TRIGGER;RELATED=END:' + trigger, 'END:VALARM');
        }
        lines.push('END:VEVENT');
      }
      lines.push('END:VCALENDAR');
      return lines.map(fold).join('\r\n') + '\r\n';
    }

    // A dated event: { key, title, course, start, end, allDay, location, desc, url }.
    const ymd = ms => { const d = new Date(ms); return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
    function eventLines(it, now, zh, domain, footer) {
      const summary = `${it.course ? `[${it.course}] ` : ''}${it.title}`;
      const out = ['BEGIN:VEVENT', 'UID:' + esc(String(it.key).replace(/[^\w:.-]/g, '_')) + '@' + domain, 'DTSTAMP:' + stamp(now)];
      if (it.allDay) out.push('DTSTART;VALUE=DATE:' + ymd(it.start), 'DTEND;VALUE=DATE:' + ymd(it.start + 36 * 3600e3));
      else out.push('DTSTART:' + stamp(it.start), 'DTEND:' + stamp(it.end > it.start ? it.end : it.start + 3600e3));
      out.push('SUMMARY:' + esc(summary));
      if (it.location) out.push('LOCATION:' + esc(it.location));
      out.push('DESCRIPTION:' + esc([it.desc, it.url, footer].filter(Boolean).join('\n')));
      if (it.url) out.push('URL:' + it.url);
      const alarms = it.allDay ? [['-PT12H', zh ? '明天' : 'Tomorrow']] : [['-P1D', zh ? '明天' : 'Tomorrow'], ['-PT2H', zh ? '2 小时后' : 'In 2 hours']];
      for (const [trigger, label] of alarms) out.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(`${label}: ${summary}`), 'TRIGGER:' + trigger, 'END:VALARM');
      out.push('END:VEVENT');
      return out;
    }

    // Exams [{ name, date: 'YYYY-MM-DD', time, end_time, location, weight, notes }] -> events.
    function fromExams(exams, { courseId = '', course = '', url = '', zh = false } = {}) {
      const at = (date, hm) => { const [y, m, d] = date.split('-').map(Number); const [H, M] = (hm || '0:0').split(':').map(Number); return new Date(y, m - 1, d, H, M).getTime(); };
      return (exams || []).filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '')).map((e, i) => {
        const start = at(e.date, e.time);
        const end = e.time && e.end_time ? at(e.date, e.end_time) : null;
        const desc = [e.weight ? (zh ? '占比 ' : 'Weight: ') + e.weight : '', e.notes || ''].filter(Boolean).join('\n');
        return { key: `syl-${courseId}-${e.date}-${i}`, title: e.name || (zh ? '考试' : 'Exam'), course, start, end, allDay: !e.time,
          location: e.location || '', desc, url };
      });
    }

    // "Add to Google Calendar" link for one event.
    function googleUrl(it, { footer = '' } = {}) {
      const dates = it.allDay ? `${ymd(it.start)}/${ymd(it.start + 36 * 3600e3)}` : `${stamp(it.start)}/${stamp(it.end > it.start ? it.end : it.start + 3600e3)}`;
      const q = new URLSearchParams({ action: 'TEMPLATE', text: `${it.course ? `[${it.course}] ` : ''}${it.title}`, dates,
        details: [it.desc, it.url, footer].filter(Boolean).join('\n') });
      if (it.location) q.set('location', it.location);
      return 'https://calendar.google.com/calendar/render?' + q.toString();
    }

    NS.ics = { build, fromExams, googleUrl, esc, fold, stamp };
  })(NS);

  (function (NS) {
    const LIMIT_BYTES = 0xFFFFFFFF - 1024 * 1024;
    const LIMIT_FILES = 0xFFFF;

    let TABLE = null;
    function crcTable() {
      if (TABLE) return TABLE;
      TABLE = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        TABLE[n] = c >>> 0;
      }
      return TABLE;
    }
    // CRC-32; pass the previous result to continue over chunks.
    function crc32(bytes, prev = 0) {
      const T = crcTable();
      let c = (prev ^ 0xFFFFFFFF) >>> 0;
      for (let i = 0; i < bytes.length; i++) c = T[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      return (c ^ 0xFFFFFFFF) >>> 0;
    }

    // MS-DOS date/time used by zip.
    function dosTime(date) {
      const d = date instanceof Date && !isNaN(date) ? date : new Date();
      const y = Math.min(Math.max(d.getFullYear(), 1980), 2107);
      return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
        date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
      };
    }

    const enc = new TextEncoder();
    const byteLen = d => d == null ? 0 : d.size != null ? d.size : d.byteLength;

    // entries: [{ name: 'Course/Week 1/slides.pdf', data: Blob | Uint8Array, crc?, date? }]
    function build(entries) {
      if (entries.length > LIMIT_FILES) throw new Error('zip_too_many');
      const parts = [], central = [];
      let offset = 0;
      for (const e of entries) {
        const name = enc.encode(e.name);
        const data = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data;
        const size = byteLen(data);
        const crc = e.crc != null ? e.crc >>> 0 : crc32(data);
        const { time, date } = dosTime(e.date);
        if (offset + 30 + name.length + size > LIMIT_BYTES) throw new Error('zip_too_big');

        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);
        lh.setUint16(6, 0x0800, true);
        lh.setUint16(8, 0, true);
        lh.setUint16(10, time, true);
        lh.setUint16(12, date, true);
        lh.setUint32(14, crc, true);
        lh.setUint32(18, size, true);
        lh.setUint32(22, size, true);
        lh.setUint16(26, name.length, true);
        lh.setUint16(28, 0, true);
        parts.push(lh.buffer, name, data);

        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true);
        ch.setUint16(8, 0x0800, true);
        ch.setUint16(10, 0, true);
        ch.setUint16(12, time, true);
        ch.setUint16(14, date, true);
        ch.setUint32(16, crc, true);
        ch.setUint32(20, size, true);
        ch.setUint32(24, size, true);
        ch.setUint16(28, name.length, true);
        ch.setUint32(42, offset, true);
        central.push(ch.buffer, name);

        offset += 30 + name.length + size;
      }
      const cdSize = central.reduce((n, p) => n + byteLen(p), 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, entries.length, true);
      end.setUint16(10, entries.length, true);
      end.setUint32(12, cdSize, true);
      end.setUint32(16, offset, true);
      return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
    }

    NS.zip = { crc32, build, dosTime, LIMIT_BYTES, LIMIT_FILES };
  })(NS);

  return { ics: NS.ics, zip: NS.zip };
});
