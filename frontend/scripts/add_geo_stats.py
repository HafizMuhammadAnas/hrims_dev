from pathlib import Path

p = Path(r"c:\Users\lenovo\Documents\hrims\website\frontend\src\pages\RegionsDistrictsAdminPage.tsx")
t = p.read_text(encoding="utf-8")

stats_tpl = """      <div style={{ marginTop: 16 }}>
        <StatsCards
          items={[
            {label_items}
          ]}
        />
      </div>

"""

marker = "  return (\n    <>\n      <TableToolbar className=\"issues-list-toolbar\">"
count = 0
pos = 0
while True:
    idx = t.find(marker, pos)
    if idx < 0:
        break
    count += 1
    if count == 1 and "Total regions" not in t[max(0, idx - 200):idx]:
        block = stats_tpl.replace("{label_items}", "\n            { label: 'Total regions', value: regions.length },\n            { label: 'Matching search', value: processed.length },")
        t = t[:idx] + "  return (\n    <>\n" + block + "      <TableToolbar className=\"issues-list-toolbar\">" + t[idx + len(marker):]
        pos = idx + len(block) + 50
        print("added regions")
    elif count == 2 and "Total districts" not in t[max(0, idx - 200):idx]:
        block = stats_tpl.replace("{label_items}", "\n            { label: 'Total districts', value: districts.length },\n            { label: 'Matching filters', value: processed.length },")
        t = t[:idx] + "  return (\n    <>\n" + block + "      <TableToolbar className=\"issues-list-toolbar\">" + t[idx + len(marker):]
        print("added districts")
        break
    else:
        pos = idx + len(marker)

p.write_text(t, encoding="utf-8")
