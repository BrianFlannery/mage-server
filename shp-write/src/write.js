var fs = require('fs'),
    types = require('./types'),
    dbf = require('./dbf'),
    prj = require('./prj'),
    ext = require('./extent'),
    getFields = require('./fields'),
    assert = require('assert'),
    pointWriter = require('./points'),
    polyWriter = require('./poly');

var writers = {
    1: pointWriter,
    5: polyWriter,
    3: polyWriter
};

var recordHeaderLength = 8;

module.exports.write = write;

// Low-level writing interface
function write(streams, rows, geometry_type, geometries, callback) {
    if (!streams.shp || !streams.shx || !streams.dbf) {
        callback(new Error('must include streams for shp, shx, and dbf'));
    }

    // TODO needs to be based on TYPE, only point for now
    var writer = require('./pointsS.js');

    var counter = 0;
    var complete = 3;
    var finish = function() {
        counter++;
        if (counter == complete) {
            return callback(null);
        }
    }

    var shpStream = streams.shp;
    var shxStream = streams.shx;
    var dbfStream = streams.dbf;
    var prjStream = streams.prj;
    if (prjStream) {
        complete++;
        prjStream.on('finish', finish);
        prjStream.end(prj);
    }

    shpStream.on('finish', finish);
    shxStream.on('finish', finish);
    dbfStream.on('finish', finish);

    var TYPE = types.geometries[geometry_type],
        shpLength = 100 + writer.shpLength(geometries),
        extent = writer.extent(geometries);

    writeHeader(shpLength / 2, TYPE, shpStream);
    writeHeader((50 + geometries.length * 4), TYPE, shxStream);
    writeExtent(extent, shpStream);
    writeExtent(extent, shxStream);

    writer.write(geometries, extent, shpStream, shxStream, TYPE);
    shpStream.end();
    shxStream.end();

    dbf.structure(rows, dbfStream);
    dbfStream.end();
}

function writeHeader(length, TYPE, stream) {
    var buffer = new Buffer(new Array(36));

    buffer.writeInt32BE(9994, 0);
    buffer.writeInt32BE(length, 24);
    buffer.writeInt32LE(1000, 28);
    buffer.writeInt32LE(TYPE, 32);

    stream.write(buffer);
}

function writeExtent(extent, stream) {
    var buffer = new Buffer(new Array(64));

    buffer.writeDoubleLE(extent.xmin, 0);
    buffer.writeDoubleLE(extent.ymin, 8);
    buffer.writeDoubleLE(extent.xmax, 16);
    buffer.writeDoubleLE(extent.ymax, 24);

    stream.write(buffer);
}

function toBuffer(view) {
    var buffer = new Buffer(view.byteLength);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    for (var i = 0; i < buffer.length; ++i) {
        ab[i] = buffer[i];
    }
    return ab;
}

function printBuffer(buffer) {
    console.log('{');
    for (var i = 0; i < buffer.length; i++) {
        console.log("'" + i + "': " + buffer[i]);
    }
    console.log('}');
}
