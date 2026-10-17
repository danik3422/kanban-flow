// Runs every user flow in order against a running stack and summarises the result.
// Flows share one account (created by s1) and must run in this order.
//   node e2e/run-flows.mjs [s2 s3 ...]
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const flowsDir = path.resolve(new URL('./flows', import.meta.url).pathname)
const order = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14']
const requested = process.argv.slice(2)
const flows = requested.length ? ['s1', ...requested.filter((flow) => flow !== 's1')] : order

const failed = []
for (const flow of flows) {
	// s2 ends by changing the shared account's password; s4 must confirm with the new one.
	const env = { ...process.env, PW: flows.indexOf('s2') > -1 && flows.indexOf('s2') < flows.indexOf(flow) ? 'Password456!' : 'Password123!' }
	const result = spawnSync(process.execPath, [path.join(flowsDir, `${flow}.mjs`)], { env, encoding: 'utf8' })
	const output = `${result.stdout}${result.stderr}`
	const passed = result.status === 0 && output.includes('ALL PASSED')
	console.log(`\n== ${flow} ${passed ? 'passed' : 'FAILED'}`)
	console.log(output.split('\n').filter((line) => /^(PASS|FAIL)|^\[|Error/.test(line)).join('\n'))
	if (!passed) failed.push(flow)
}
console.log(failed.length ? `\nFailed flows: ${failed.join(', ')}` : '\nAll flows passed')
process.exitCode = failed.length ? 1 : 0
