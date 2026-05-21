export function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function titleCaseName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z0-9&]{2,}$/.test(word)) return word
      if (/^\d/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}
