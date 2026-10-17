# canvas-export

**Export from Canvas LMS, in the browser.** Two small helpers with no dependencies:

- **`ics`** turns Canvas deadlines and exams into an `.ics` calendar file for Google Calendar, Apple Calendar or Outlook, or into an "Add to Google Calendar" link.
- **`zip`** bundles many files (for example a whole course's slides) into one `.zip`, built right in the browser.

They are the export code inside [Canvas+](https://getcanvasplus.com), a Chrome extension for students on Canvas.

[中文说明](README.zh-CN.md)

## Install

```bash
npm install canvas-export        # or copy index.js into your project
```

```js
const { ics, zip } = require('canvas-export');
```

In a browser, a `<script src="index.js">` gives you `window.CanvasExport`.

## Calendar (.ics)

```js
const text = ics.build([
  { key: 'assignment:42', title: 'Homework 3', course: 'CS 1020', due: Date.parse('2026-10-20T23:59-04:00'),
    url: 'https://canvas.example.edu/courses/1/assignments/42', share: 2.5 }
], { domain: 'canvas.example.edu' });
// -> an iCalendar file: each deadline is a 30-minute event ending at the due time,
//    with reminders 1 day and 2 hours before
```

- Item fields: `{ key, title, course?, due, url?, share? }`. `share` is the item's % of the final grade and goes in the description. Dated events use `{ start, end?, allDay?, location?, desc? }` instead of `due`.
- Options: `{ now, lang: 'en' | 'zh', domain, prodId, calName, footer }`. `footer` adds a last line to every description, e.g. `"Exported by My App"`.
- Follows RFC 5545: escapes text, folds lines at 75 bytes without splitting multi-byte characters, and uses UTC timestamps.

```js
const events = ics.fromExams([{ name: 'Midterm', date: '2026-10-28', time: '18:30', end_time: '20:00', location: 'Room 113' }], { course: 'CS 1020' });
ics.googleUrl(events[0]);   // https://calendar.google.com/calendar/render?action=TEMPLATE&...
```

## Zip in the browser

```js
const blob = zip.build([
  { name: 'Week 1/slides.pdf', data: uint8Array },
  { name: 'Week 2/notes.pdf', data: someBlob, crc: crcWorkedOutWhileDownloading }
]);
// -> Blob (application/zip): save it with an <a download> link
```

- **Stored, not compressed.** PDFs, slides and Office files are already compressed, so zipping them again saves almost nothing and takes a long time.
- **Blobs are not copied into memory.** Pass a Blob together with its CRC-32. Use `zip.crc32(chunk, previous)` to work it out chunk by chunk while you download.
- **Readable non-English names.** File names are stored as UTF-8, so Chinese and other names show correctly when unzipped.
- **Classic zip only.** Up to 65,535 files and just under 4 GB. `build` throws `zip_too_many` or `zip_too_big` beyond that.

See `examples/` for a runnable calendar script and a zip page you can open in a browser.

## License

MIT © Baowen Liu. The MIT license covers the code only. The names **Canvas+** and **Canvas Plus** and the Canvas+ logo are not licensed.

Canvas is a trademark of Instructure, Inc. This project is independent and is not affiliated with or endorsed by Instructure.
