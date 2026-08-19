/**
 * First integer in an article title ("Article 12" → 12).
 * Titles without a number sort after numbered ones.
 */
export function articleNaturalNumber(name: string | null | undefined): number | null {
  if (!name?.trim()) return null
  const match = name.match(/(\d+)/)
  if (!match) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}

function compareArticleNames(
  nameA: string,
  idA: number,
  nameB: string,
  idB: number,
): number {
  const numA = articleNaturalNumber(nameA)
  const numB = articleNaturalNumber(nameB)

  if (numA !== null && numB !== null && numA !== numB) return numA - numB
  if (numA !== null && numB === null) return -1
  if (numA === null && numB !== null) return 1

  const byName = nameA.localeCompare(nameB, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
  if (byName !== 0) return byName
  return idA - idB
}

/** Article 1, 2, 3 … 10 (not alphabetical Article 1, 10, 11, 2). */
export function sortArticlesByNaturalName<T extends { id: number; article_name: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) =>
    compareArticleNames(a.article_name, a.id, b.article_name, b.id),
  )
}

type IssueWithArticles = {
  id: number
  articles: Array<{ id: number; article_name: string }>
}

/**
 * Order LOI / recommendation rows by linked Articles (Article 1 → onward).
 * Within each row, articles are also natural-sorted for display.
 * Rows with no articles come last.
 */
export function sortIssuesByArticles<T extends IssueWithArticles>(rows: T[]): T[] {
  return [...rows]
    .map((row) => ({
      ...row,
      articles: sortArticlesByNaturalName(row.articles),
    }))
    .sort((a, b) => {
      const firstA = a.articles[0]
      const firstB = b.articles[0]

      if (firstA && firstB) {
        const byArticle = compareArticleNames(
          firstA.article_name,
          firstA.id,
          firstB.article_name,
          firstB.id,
        )
        if (byArticle !== 0) return byArticle
      } else if (firstA && !firstB) {
        return -1
      } else if (!firstA && firstB) {
        return 1
      }

      return a.id - b.id
    })
}
