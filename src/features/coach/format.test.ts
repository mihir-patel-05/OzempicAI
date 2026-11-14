import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCoachText, parseInline } from './format'

test('parseInline splits bold runs', () => {
  assert.deepEqual(parseInline('You averaged **1,640 kcal** a day.'), [
    { text: 'You averaged ', bold: false },
    { text: '1,640 kcal', bold: true },
    { text: ' a day.', bold: false },
  ])
})

test('parseInline drops an unclosed ** while streaming', () => {
  assert.deepEqual(parseInline('Monday: **Chicken'), [
    { text: 'Monday: ', bold: false },
    { text: 'Chicken', bold: false },
  ])
})

test('paragraphs keep line breaks and split on blank lines', () => {
  assert.deepEqual(parseCoachText('Line one\nLine two\n\nNew paragraph'), [
    { type: 'p', lines: [[{ text: 'Line one', bold: false }], [{ text: 'Line two', bold: false }]] },
    { type: 'p', lines: [[{ text: 'New paragraph', bold: false }]] },
  ])
})

test('bullet and numbered lists', () => {
  const blocks = parseCoachText('Try this:\n- More protein\n* Earlier dinner\n\n2. Second\n3) Third')
  assert.equal(blocks.length, 3)
  assert.deepEqual(blocks[1], {
    type: 'ul',
    items: [[{ text: 'More protein', bold: false }], [{ text: 'Earlier dinner', bold: false }]],
  })
  assert.deepEqual(blocks[2], {
    type: 'ol',
    start: 2,
    items: [[{ text: 'Second', bold: false }], [{ text: 'Third', bold: false }]],
  })
})

test('indented continuation joins the list item; a plain line ends the list', () => {
  const blocks = parseCoachText('- **Mon**: Salmon\n  with rice\nThat is all.')
  assert.deepEqual(blocks[0], {
    type: 'ul',
    items: [
      [
        { text: 'Mon', bold: true },
        { text: ': Salmon', bold: false },
        { text: ' ', bold: false },
        { text: 'with rice', bold: false },
      ],
    ],
  })
  assert.deepEqual(blocks[1], { type: 'p', lines: [[{ text: 'That is all.', bold: false }]] })
})

test('headings render as a bold line and nothing is treated as HTML', () => {
  assert.deepEqual(parseCoachText('## Your week\n<b>hi</b>'), [
    { type: 'p', lines: [[{ text: 'Your week', bold: true }]] },
    { type: 'p', lines: [[{ text: '<b>hi</b>', bold: false }]] },
  ])
})
