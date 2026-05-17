from pathlib import Path

p = Path(r"c:\Users\lenovo\Documents\hrims\website\frontend\src\components\MinistryCompiledRecordViewModal.tsx")
t = p.read_text(encoding="utf-8")

old_start = """  return (
    <motionStats
      className="modal-overlay ministry-compiled-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ministry-compiled-title"
      onClick={onClose}
    >
      <motionStats
        className="modal-card modal-card-wide ministry-compiled-modal workflow-tabbed-card hr-request-dept-portal-tabs"
        onClick={(e) => e.stopPropagation()}
      >
        <WorkflowModalHero
          eyebrow="National compilation · Ministry submission"
          title={record.title?.trim() || 'Compiled record'}
          titleId="ministry-compiled-title"
          onClose={onClose}
        >""".replace("motionStats", "div")

new_start = """  const card = (
      <motionStats
        className="modal-card modal-card-wide ministry-compiled-modal workflow-tabbed-card hr-request-dept-portal-tabs"
      >
        <WorkflowModalHero
          eyebrow="National compilation · Ministry submission"
          title={record.title?.trim() || 'Compiled record'}
          titleId="ministry-compiled-title"
          onClose={isPage ? undefined : onClose}
          embedded={isPage}
        >""".replace("motionStats", "motionStats").replace("motionStats", "div")

old_end = """          <ModalActions className="ministry-compiled-modal__actions">
            <Button variant="secondary" compact type="button" onClick={onClose}>
              Close
            </Button>"""

new_end = """          <ModalActions className="ministry-compiled-modal__actions">
            {!isPage && onClose ? (
              <Button variant="secondary" compact type="button" onClick={onClose}>
                Close
              </Button>
            ) : null}"""

old_close = """        </motionStats>
      </motionStats>
    </motionStats>
  )
}""".replace("motionStats", "div")

new_close = """        </motionStats>
  )

  if (isPage) {
    return card
  }

  return (
    <motionStats
      className="modal-overlay ministry-compiled-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ministry-compiled-title"
      onClick={onClose}
    >
      <motionStats onClick={(e) => e.stopPropagation()}>{card}</motionStats>
    </motionStats>
  )
}""".replace("motionStats", "div")

for name, block in [("start", old_start), ("end", old_end), ("close", old_close)]:
    if block not in t:
        raise SystemExit(f"{name} block not found")

t = t.replace(old_start, new_start, 1)
t = t.replace(old_end, new_end, 1)
t = t.replace(old_close, new_close, 1)
p.write_text(t, encoding="utf-8", newline="\n")
print("ok")
