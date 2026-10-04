import fs from 'node:fs'

const helpFiles = [
  'src/lib/helpTopics.ts',
  'src/lib/expandedHelpGuides.ts',
  'src/lib/settingsHelp.ts',
  'src/lib/settingsHelpDetails.ts',
]

const helpSource = helpFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
const routerSource = fs.readFileSync('src/main.tsx', 'utf8')
const routes = [...routerSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
const markdownLinks = [...helpSource.matchAll(/\]\((\/[^)\s]+)\)/g)].map((match) => match[1])
const settingsRoutes = [...helpSource.matchAll(/route:\s*'([^']+)'/g)]
  .map((match) => match[1])
  .filter((route) => route.startsWith('/'))
const destinations = [...new Set([...markdownLinks, ...settingsRoutes])].sort()

const pathname = (value) => value.split(/[?#]/, 1)[0]
const matchesRoute = (destination, route) => {
  const targetParts = pathname(destination).split('/').filter(Boolean)
  const routeParts = pathname(route).split('/').filter(Boolean)
  return targetParts.length === routeParts.length && routeParts.every((part, index) =>
    part === '*' || part.startsWith(':') || part === targetParts[index],
  )
}

const brokenLinks = destinations.filter((destination) =>
  !routes.some((route) => matchesRoute(destination, route)),
)
const redirectRoutes = new Map(
  [...routerSource.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<Navigate\s+to="([^"]+)"/g)]
    .map((match) => [match[1], match[2]]),
)
const legacyRedirectLinks = destinations
  .filter((destination) => redirectRoutes.has(pathname(destination)))
  .map((destination) => `${destination} -> ${redirectRoutes.get(pathname(destination))}`)

const topicIds = [...helpSource.matchAll(/^\s{4}id:\s*'([^']+)'/gm)].map((match) => match[1])
const duplicateTopicIds = topicIds.filter((id, index) => topicIds.indexOf(id) !== index)
const settingsIds = [...fs.readFileSync('src/lib/settingsHelp.ts', 'utf8').matchAll(/\{ id:\s*'([^']+)'/g)]
  .map((match) => match[1])
const knownTopicIds = new Set([...topicIds, ...settingsIds.map((id) => `settings-${id}`)])
const routeTopicIds = [...fs.readFileSync('src/lib/helpTopics.ts', 'utf8').matchAll(/topicId:\s*'([^']+)'/g)]
  .map((match) => match[1])
const missingTopicIds = [...new Set(routeTopicIds.filter((id) => !knownTopicIds.has(id)))].sort()

if (brokenLinks.length || legacyRedirectLinks.length || duplicateTopicIds.length || missingTopicIds.length) {
  console.error('Help audit failed.')
  if (brokenLinks.length) console.error(`Broken internal links:\n- ${brokenLinks.join('\n- ')}`)
  if (duplicateTopicIds.length) console.error(`Duplicate topic slugs:\n- ${[...new Set(duplicateTopicIds)].join('\n- ')}`)
  if (missingTopicIds.length) console.error(`Route mappings with missing topic slugs:\n- ${missingTopicIds.join('\n- ')}`)
  process.exit(1)
}

console.log(`Help audit passed: ${destinations.length} destinations, ${knownTopicIds.size} topic slugs, ${routes.length} routes.`)
