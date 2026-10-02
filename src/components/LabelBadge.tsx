import type { Label } from '../analysis/types'
import { isTip, LABEL_TITLE } from './format'

export function LabelBadge({ label }: { label: Label }) {
  return (
    <div className={`label ${isTip(label.kind) ? 'tip' : 'problem'}`}>
      <strong>{LABEL_TITLE[label.kind]}</strong>
      <span>{label.text}</span>
    </div>
  )
}
