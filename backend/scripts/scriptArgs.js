import mongoose from 'mongoose'

import { env } from '../config/env.js'

// Shared safety for the maintenance scripts: options come from the command line, never
// from addresses written into the code, and scripts that wipe data refuse to touch a
// production database or one whose name was not typed out to confirm.

/** `--name=value` from the command line, or '' when it is missing. */
export const option = (name) => {
	const prefix = `--${name}=`
	return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim() || ''
}

/** The value of a required `--name=value`, or stops with the usage line. */
export const requireOption = (name, usage) => {
	const value = option(name)
	if (!value) throw new Error(`Missing --${name}=…\nUsage: ${usage}`)
	return value
}

/** Stops when NODE_ENV is production: demo and reset scripts are for local and test databases. */
export const refuseInProduction = (what) => {
	if (env.isProduction) throw new Error(`${what} is not allowed with NODE_ENV=production.`)
}

/** Connects, then stops unless `--confirm=<database name>` names the database it reached. */
export const connectConfirmed = async (usage) => {
	if (!env.mongoUri) throw new Error('MONGO_URI is not configured')
	await mongoose.connect(env.mongoUri)
	const name = mongoose.connection.db.databaseName
	const host = mongoose.connection.host
	if (option('confirm') !== name) {
		throw new Error(`This script deletes data in the database "${name}" on ${host}. Run it again with --confirm=${name} if that is what you want.\nUsage: ${usage}`)
	}
	console.log(`Working on the database "${name}" on ${host}.`)
	return name
}
