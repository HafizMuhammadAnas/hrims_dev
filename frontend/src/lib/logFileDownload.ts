import { ensureCsrfCookie, apiJsonHeaders } from '../api/client'

export type DownloadFileType = 'pdf' | 'word' | 'excel' | 'other'

function guessFileType(fileName: string): DownloadFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'doc' || ext === 'docx' || ext === 'rtf') return 'word'
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'excel'
  return 'other'
}

/** Fire-and-forget: records a client-side download for Super Admin activity logs. */
export function logFileDownload(
  fileName: string,
  fileType?: DownloadFileType,
  source = 'client_export',
): void {
  const name = fileName.trim()
  if (!name) return

  void (async () => {
    try {
      await ensureCsrfCookie()
      await fetch('/api/v1/activity-logs/download', {
        method: 'POST',
        credentials: 'include',
        headers: apiJsonHeaders(),
        body: JSON.stringify({
          file_name: name,
          file_type: fileType ?? guessFileType(name),
          source,
        }),
      })
    } catch {
      // Never block the user download if logging fails.
    }
  })()
}
