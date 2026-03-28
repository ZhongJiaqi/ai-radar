/** Insert spaces between CJK and Latin/digit characters */
export function pangu(text: string): string {
  return text
    .replace(/([\u4e00-\u9fff\u3400-\u4dbf])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1 $2')
}
