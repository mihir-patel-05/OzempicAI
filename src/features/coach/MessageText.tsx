import { Fragment, useMemo } from 'react'
import { parseCoachText, type Inline } from './format'

function Runs({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, i) => (run.bold ? <strong key={i}>{run.text}</strong> : <Fragment key={i}>{run.text}</Fragment>))}
    </>
  )
}

/** Renders a coach reply's light Markdown as plain React elements. */
export function MessageText({ text }: { text: string }) {
  const blocks = useMemo(() => parseCoachText(text), [text])
  return (
    <div className="coach-text">
      {blocks.map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Runs runs={line} />
                </Fragment>
              ))}
            </p>
          )
        }
        const items = block.items.map((item, j) => (
          <li key={j}>
            <Runs runs={item} />
          </li>
        ))
        return block.type === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i} start={block.start}>{items}</ol>
      })}
    </div>
  )
}
