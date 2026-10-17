// node examples/calendar.js > deadlines.ics
// Canvas planner items -> an .ics file you can import into Google / Apple Calendar or Outlook.
const { ics } = require('..');

const deadlines = [   // e.g. from GET /api/v1/planner/items
  { key: 'assignment:42', title: 'Homework 3', course: 'CS 1020', due: Date.parse('2026-10-20T23:59:00-04:00'),
    url: 'https://canvas.example.edu/courses/1/assignments/42', share: 2.5 },   // share: % of the final grade (optional)
  { key: 'quiz:7', title: 'Quiz 2', course: 'MATH 1100', due: Date.parse('2026-10-22T10:00:00-04:00') }
];
process.stdout.write(ics.build(deadlines, { domain: 'canvas.example.edu', calName: 'My deadlines' }));

// One exam as an "Add to Google Calendar" link (no file needed):
const [exam] = ics.fromExams([{ name: 'Midterm', date: '2026-10-28', time: '18:30', end_time: '20:00', location: 'Room 113' }], { course: 'CS 1020' });
console.error('\nGoogle Calendar link:', ics.googleUrl(exam));
