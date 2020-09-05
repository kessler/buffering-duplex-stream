const test = require('ava')
const BufferingDuplexStream = require('./index.js')
const { Readable, Writable, pipeline: callbackPipeline } = require('stream')
const { promisify } = require('util')
const pipeline = promisify(callbackPipeline)

let expectedOutput = ''
for (let i = 0; i < 205; i++) {
	expectedOutput += i.toString()
}


test('BufferingDuplexStream will write chunk the size of the flushThreshold, the last chunk can be smaller', async t => {
	const bfStream = BufferingDuplexStream.create({
		flushThreshold: 100
	})

	const source = Readable.from(generate())
	const target = new Target()

	await pipeline(source, bfStream, target)
	const outputData = target.data

	const outputString = outputData.reduce((acc, item) => acc + item.chunk.toString(), '')
	const outputSize = outputData.reduce((acc, item) => acc + item.size, 0)
	t.is(outputSize, Buffer.byteLength(expectedOutput))
	t.is(outputString, expectedOutput)
	t.is(outputData[0].size, 100)
	t.is(outputData[1].size, 99)
	t.is(outputData[2].size, 99)
	t.is(outputData[3].size, 99)
	t.is(outputData[4].size, 99)
	t.is(outputData[5].size, 9)
})

test('BufferingDuplexStream will emit an error if a single chunk is bigger than the flush threshold', async t => {
	const bfStream = BufferingDuplexStream.create({
		flushThreshold: 1
	})

	const source = Readable.from(generate())
	const target = new Target()

	await t.throwsAsync(async () => {
		await pipeline(source, bfStream, target)
	}, { instanceOf: Error, message: 'chunk too big, since we dont cut chunks you will need to increase flush threshold' })
})

test.skip('BufferingDuplexStream pipe to a stream with a very small buffer', async t => {
	const bfStream = BufferingDuplexStream.create({
		flushThreshold: 100
	})

	const source = Readable.from(generate())
	const target = new SlowTarget()
	
	await pipeline(source, bfStream, target)

})

async function* generate() {
	for (let i = 0; i < 205; i++) {
		yield i.toString()
	}
}

class Target extends Writable {
	constructor() {
		super()
		this.data = []
	}

	_write(chunk, enc, callback) {

		this.data.push({
			chunk,
			size: Buffer.byteLength(chunk)
		})

		callback()
	}
}

class SlowTarget extends Writable {
	constructor() {
		super({ highWaterMark: 1 })
		this.data = []
	}

	_write(chunk, enc, callback) {

		this.data.push({
			chunk,
			size: Buffer.byteLength(chunk)
		})

		setTimeout(callback, 10000)
	}
}