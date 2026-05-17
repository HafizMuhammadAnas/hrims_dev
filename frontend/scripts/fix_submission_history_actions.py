from pathlib import Path

p = Path(r"c:\Users\lenovo\Documents\hrims\website\frontend\src\pages\workflow\SubmissionHistoryPage.tsx")
t = p.read_text(encoding="utf-8")
needle = "View compilation"
pos = t.find(needle)
if pos < 0:
    raise SystemExit("needle not found")
start = t.rfind("<td className=\"table-actions\">", 0, pos)
close = t.find("</td>", pos)
block = t[start:close]
if "RowActionsMenu" in block:
    print("already fixed")
    raise SystemExit(0)
new = """<td className="table-actions">
                    <RowActionsMenu
                      isOpen={openActionId === `resp-${r.id}`}
                      onOpenChange={(open) => setOpenActionId(open ? `resp-${r.id}` : null)}
                    >
                      <Button
                        variant="link"
                        onClick={() => {
                          navigate(regionalCompilationViewPath(r.id, historyFrom))
                          setOpenActionId(null)
                        }}
                      >
                        View compilation
                      </Button>
                      {regional && r.review_status === 'needs-modification' ? (
                        <Button
                          variant="link"
                          onClick={() => {
                            navigate(regionalCompilationViewPath(r.id, historyFrom, { edit: true }))
                            setOpenActionId(null)
                          }}
                        >
                          Edit compilation
                        </Button>
                      ) : null}
                    </RowActionsMenu>
                  """
t = t[:start] + new + t[close:]
p.write_text(t, encoding="utf-8")
print("ok")
