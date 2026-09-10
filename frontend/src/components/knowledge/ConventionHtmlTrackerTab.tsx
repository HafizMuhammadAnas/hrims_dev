type Props = {
  conventionCode: string
  src: string
}

export function ConventionHtmlTrackerTab({ conventionCode, src }: Props) {
  const code = conventionCode.trim().toUpperCase()
  return (
    <section className="convention-html-tracker" aria-label={`${code} Tracker`}>
      <iframe
        className="convention-html-tracker__frame"
        title={`${code} Tracker`}
        src={src}
        loading="lazy"
      />
    </section>
  )
}
