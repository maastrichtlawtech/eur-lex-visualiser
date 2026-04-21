const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTitleJson } = require('./recital-title-service');

test('parseTitleJson extracts valid recital title mappings', () => {
  const titles = parseTitleJson('```json\n{"1":" Fundamental right to data protection.","2":"Free movement of data","999":"Ignore me"}\n```', ['1', '2']);

  assert.deepEqual(titles, {
    1: 'Fundamental right to data protection',
    2: 'Free movement of data',
  });
});

test('parseTitleJson returns empty object for malformed responses', () => {
  assert.deepEqual(parseTitleJson('not json', ['1']), {});
});
