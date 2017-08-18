// 32-bit Modular Binary Addition, JavaScript style
// because JavaScript would do weird things if you
// tried to just add the numbers.
function safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
}

function Uint32ArrayFromBuffer(buf) {
    var uint8arr = new Uint8Array(buf);
    var result = new Uint32Array(Math.ceil(uint8arr.length / 4));

    for (var i = 0; i < uint8arr.length; i += 4) {
        var number = 0x00000000;

        number = safe_add(number, uint8arr[i    ] << 24);
        number = safe_add(number, uint8arr[i + 1] << 16);
        number = safe_add(number, uint8arr[i + 2] << 8);
        number = safe_add(number, uint8arr[i + 3] << 0);

        result[i / 4] = number;
    }

    return result;
}

function BufferFromUint32Array(uintarr) {
    var result = Buffer.alloc(uintarr.length * 4, 0x00);

    for (var i = 0; i < uintarr.length; i++) {
        var buf = Buffer.from(("0000000000" + uintarr[i].toString(16)).substr(-8), 'hex'); // @TODO: inefficient

        result[(i * 4)    ] = buf[0];
        result[(i * 4) + 1] = buf[1];
        result[(i * 4) + 2] = buf[2];
        result[(i * 4) + 3] = buf[3];
    }

    return result;
}

module.exports = exports = {
    safe_add: safe_add,
    Uint32ArrayFromBuffer: Uint32ArrayFromBuffer,
    BufferFromUint32Array: BufferFromUint32Array
};
