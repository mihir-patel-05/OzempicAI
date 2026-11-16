import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

// server.ts imports the database pool; nothing here connects to it.
process.env.DATABASE_URL ??= 'postgres://unused@localhost:1/unused'
const { buildMcpServer, toolsFor } = await import('./server.js')
const { TOOLS } = await import('../ai/tools/index.js')

const caller = (scopes: ('read' | 'write')[]) => ({
  userId: '00000000-0000-0000-0000-000000000001',
  grantId: '00000000-0000-0000-0000-0000000000aa',
  scopes,
  clientName: 'Claude',
})

test('toolsFor hides write tools from read-only connections', () => {
  const readOnly = toolsFor(['read'])
  assert.ok(readOnly.length > 0)
  assert.ok(readOnly.every((tool) => tool.annotations?.readOnlyHint === true))
  assert.ok(!readOnly.some((tool) => tool.name === 'add_grocery_items'))

  const all = toolsFor(['read', 'write'])
  assert.equal(all.length, TOOLS.length)
  const update = all.find((tool) => tool.name === 'update_workout_plan')!
  assert.deepEqual(update.annotations, {
    title: 'Edit a planned workout',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  })
  const add = all.find((tool) => tool.name === 'add_grocery_items')!
  assert.equal(add.annotations?.destructiveHint, false)
  assert.equal(add.inputSchema.type, 'object')
  assert.deepEqual(
    all.map((tool) => tool.name),
    [...all.map((tool) => tool.name)].sort(),
  )
})

test('an MCP client can list and call tools through buildMcpServer', async () => {
  const calls: { name: string; args: unknown }[] = []
  const server = buildMcpServer(caller(['read']), async (_caller, name, args) => {
    calls.push({ name, args })
    return { content: [{ type: 'text', text: '{"ok":true}' }] }
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(clientSide)

  assert.match(client.getInstructions() ?? '', /get_profile first/)
  const { tools } = await client.listTools()
  assert.ok(tools.some((tool) => tool.name === 'get_profile'))
  assert.ok(!tools.some((tool) => tool.name === 'create_meal_plan'))

  const result = await client.callTool({ name: 'get_grocery_list', arguments: { include_purchased: false } })
  assert.deepEqual(result.content, [{ type: 'text', text: '{"ok":true}' }])
  assert.deepEqual(calls, [{ name: 'get_grocery_list', args: { include_purchased: false } }])
  await client.close()
})
