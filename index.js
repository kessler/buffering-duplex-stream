const debug = require('debug')('buffering-duplex-stream')
const { Duplex } = require('stream')

const BUFFERING = 'buffering'
const WAITING_FOR_FLUSH = 'waiting for flush'
const DONE = 'done'
const ERROR = 'error'

class BufferingDuplexStream extends Duplex {

	/**
	 * @param {Object} options
	 * @param {Number} options.flushThreshold
	 * @param {Object} options.streamOptions
	 *
	 */
	constructor({ flushThreshold = 1024 * 1024 * 10, streamOptions }) {
		super(streamOptions)
		this._flushThreshold = flushThreshold
		this._initBuffer()
	}

	get _state() {
		return this.__state
	}

	set _state(value) {
		debug('set state', this.__state, '->', value)
		this.__state = value
	}

	async _read(size) {
		if (this._state === ERROR) return

		if (this._state === DONE) {
			debug('_read done')
			this.push(null)
			return
		}

		while (this._state === BUFFERING) {
			debug('_read tick, bufferPosition=', this._bufferPosition)
			await tick()
		}

		debug('_read size=', size, 'bufferPosition=', this._bufferPosition)
		this.push(this._buffer.slice(0, this._bufferPosition))
		
		if (this._state === DONE) {
			this.push(null)
		} else {
			this._initBuffer()
		}
	}

	async _writeImpl({ chunk, encoding }) {
		if (this._state === ERROR) return

		if (encoding !== 'buffer') {
			debug('_writeImpl - converting string to buffer using encoding=', encoding)
			chunk = Buffer.from(chunk, encoding)
		}

		if (chunk.length > this._buffer.length) {
			debug('_writeImpl chunk too big', chunk.length, '>', this._buffer.length)
			this._state = ERROR
			this.emit('error', new Error('chunk too big, since we dont cut chunks you will need to increase flush threshold'))
			return
		}

		while (this._bufferPosition + chunk.length > this._buffer.length) {
			debug('_writeImpl tick', 'bufferPosition=', this._bufferPosition, 'chunk length=', chunk.length)
			this._state = WAITING_FOR_FLUSH
			await tick()
		}

		try {
			debug('_writeImpl copying chunk.length=', chunk.length, 'bytes, bufferPosition=', this._bufferPosition)

			const bytesCopied = chunk.copy(this._buffer, this._bufferPosition)
			if (bytesCopied !== chunk.length) {
				this._state = ERROR
				debug('_writeImpl unexpected number of bytes copied', bytesCopied, '!==', chunk.length)
				this.emit('error', new Error('unexpected number of bytes copied'))
				return
			}

			this._bufferPosition += bytesCopied
		} catch (e) {
			debug(e)
			this._state = ERROR
			this.emit('error', e)
		}
	}

	_final(callback) {
		debug('_final')
		this._state = DONE
		callback()
	}

	async _write(chunk, encoding, callback) {
		debug('_write')
		await this._writeImpl({ chunk, encoding })
		callback()
	}

	async _writev(chunks, callback) {
		debug('_writev')
		for (const chunk of chunks) {
			await this._writeImpl(chunk)
		}
		callback()
	}

	_initBuffer() {
		debug('_initBuffer')
		this._buffer = Buffer.alloc(this._flushThreshold)
		this._bufferPosition = 0
		this._state = BUFFERING
	}

	static create(options) {
		return new BufferingDuplexStream(options)
	}
}

function tick() {
	return new Promise(res => setTimeout(res, 100))
}

module.exports = BufferingDuplexStream