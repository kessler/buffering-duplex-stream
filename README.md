# @kessler/buffering-duplex-stream

A duplex stream that serves as a dam or a buffer, holding written data until a certain threshold is met then releasing it to the read side

This is basically a flow control stream.

## Install
```
npm i @kessler/buffering-duplex-stream
```

## Example
```js
const BufferingDuplexStream = require('./index.js')
const { promisify } = require('util')
const { Readable, pipeline: callbackPipeline } = require('stream')
const pipeline = promisify(callbackPipeline)

/**
 * outputs:
 *
 *  "00000" = 5 bytes
 *  "00000" = 5 bytes
 *  "11111" = 5 bytes
 *  "11111" = 5 bytes
 *  "22222" = 5 bytes
 *  "22222" = 5 bytes
 *  "33333" = 5 bytes
 *  "33333" = 5 bytes
 *
 */
async function main() {
    const bfStream = BufferingDuplexStream.create({
        flushThreshold: 5 //bytes
    })

    const source = Readable.from(generateData())

    pipeline(source, bfStream)

    for await (const chunk of bfStream) {
        console.log(`"${chunk.toString()}" = ${Buffer.byteLength(chunk)} bytes`)
    }
}

main()

async function* generateData() {
    for (let i = 0; i < 4; i++) {
        for (let x = 0; x < 10; x++) {
            yield i.toString()
        }
    }
}
```
