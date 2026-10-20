/**
 * A file download that checks only `res.ok` saves whatever came back. A
 * proxy or an expired session can answer 200 with a web page, and the
 * browser would save that page as the PDF or CSV, so the download looks
 * like it worked. Check the response after `res.ok`, before `res.blob()`.
 */
export const NOT_A_FILE_MESSAGE = "The download didn't come back as a file. Try again."

/**
 * False when the body is a web page or JSON rather than a file, or, given
 * `expected` (e.g. 'application/pdf'), when it isn't that type.
 */
export function isFileResponse(res: Response, expected?: string): boolean {
  const type = (res.headers.get('content-type') ?? '').toLowerCase()
  if (type.includes('text/html') || type.includes('application/json')) return false
  return expected === undefined || type.includes(expected)
}

/** Throws NOT_A_FILE_MESSAGE when isFileResponse is false. */
export function assertFileResponse(res: Response, expected?: string): void {
  if (!isFileResponse(res, expected)) throw new Error(NOT_A_FILE_MESSAGE)
}
