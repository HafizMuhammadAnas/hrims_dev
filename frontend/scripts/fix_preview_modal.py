from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/components/RegionalResponsePreviewModal.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace("<motionStats", "<motionStats").replace("</motionStats>", "</motionStats>")
t = t.replace("motionStats", "div") if "motionStats" in t else t
# fix - only div tags
lines = p.read_text(encoding="utf-8").splitlines()
# find second export function RegionalResponsePreviewModal
start_dup = None
count = 0
for i, line in enumerate(lines):
    if line.startswith("export function RegionalResponsePreviewModal"):
        count += 1
        if count == 2:
            start_dup = i
            break
if start_dup:
    lines = lines[:start_dup]
    lines.append("")
    lines.append("export function RegionalResponsePreviewModal({ row, tasksForDetail, onClose, footerExtra }: Props) {")
    lines.append("  if (!row) return null")
    lines.append("  return (")
    lines.append('    <motionStats className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>')
    lines.append('      <motionStats onClick={(e) => e.stopPropagation()}>')
    lines.append("        <RegionalResponsePreviewView")
    lines.append("          row={row}")
    lines.append("          tasksForDetail={tasksForDetail}")
    lines.append("          onClose={onClose}")
    lines.append("          footerExtra={footerExtra}")
    lines.append("        />")
    lines.append("      </motionStats>")
    lines.append("    </motionStats>")
    lines.append("  )")
    lines.append("}")
    text = "\n".join(lines) + "\n"
    text = text.replace("motionStats", "div")
    p.write_text(text, encoding="utf-8")
    print("trimmed duplicate")
else:
    text = p.read_text(encoding="utf-8").replace("motionStats", "motionStats")
    text = text.replace("<motionStats", "<div").replace("</motionStats>", "</div>")
    p.write_text(text, encoding="utf-8")
    print("fixed tags only")
