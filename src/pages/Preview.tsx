import type { CSSProperties } from 'react';
import { FONT_STACKS } from '@/src/content/fonts';
import { LINE_WIDTH_CH, type ReaderSettings } from '@/src/lib/settings';

/** A live sample of the reading surface with the current settings. */
export function Preview({ settings }: { settings: ReaderSettings }) {
  const style = {
    '--font': FONT_STACKS[settings.fontFamily],
    '--font-size': `${settings.fontSize}px`,
    '--line-height': settings.lineHeight,
    '--measure': LINE_WIDTH_CH[settings.lineWidth],
    '--para-space': `${settings.paragraphSpacing}em`,
    '--letter-space': `${settings.letterSpacing}em`,
    '--word-space': `${settings.wordSpacing}em`,
  } as CSSProperties;
  return (
    <div
      className={`reader-preview theme-${settings.theme}`}
      style={style}
      aria-label="Preview of your reading settings"
    >
      <article className="page">
        <h2 className="title">Preview</h2>
        <div className="content">
          <p>
            This is how articles will look. Adjust the font, size and spacing until reading feels
            effortless — there is no single right setting.
          </p>
          <p className="dl-anchor">
            The amber bar marks the last paragraph you actually read, so getting back after a
            distraction takes a second.
          </p>
        </div>
      </article>
    </div>
  );
}
