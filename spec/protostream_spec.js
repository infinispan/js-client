//'use strict';

var _ = require('underscore');
var path = require('path');

var t = require('./utils/testing'); // Testing dependency
var protobuf = require('protobufjs');
const { iteratee } = require('underscore');

var myMsg = `package awesomepackage;
syntax = "proto3";
message AwesomeMessage {
    string awesome_field = 1; // becomes awesomeField
}`

var p30 = t.protocol30({
    dataFormat: {
        keyType: 'application/x-protostream',
        valueType: 'application/x-protostream'
    }
});

describe('Protobuf encoding', function () {
    var expectedArray = [0x0a, 0x0d, 0x41, 0x77, 0x65, 0x73, 0x6f, 0x6d, 0x65, 0x53, 0x74, 0x72, 0x69, 0x6e, 0x67];
    var expectedBuffer = Buffer.from(expectedArray);
    it("Encodes a proto message", function (done) {
        root = protobuf.parse(myMsg).root;

        // Obtain a message type
        var AwesomeMessage = root.lookupType("awesomepackage.AwesomeMessage");
        var payload = { awesomeField: "AwesomeString" };
        var errMsg = AwesomeMessage.verify(payload);
        expect(errMsg === null).toBeTruthy();
        done();
        var message = AwesomeMessage.create(payload); // or use .fromObject if conversion is necessary
        var buffer = AwesomeMessage.encode(message).finish();
        expect(Buffer.compare(buffer, expectedBuffer)).toBe(0);
    });
}
);

describe('Protostream encoding', function () {
    p30.registerProtostreamType("AwesomeMessage", 42);

    it("Returns the Protostream type", function () {
        var psType = p30.lookupProtostreamTypeByName("AwesomeMessage");
        expect(psType.protostreamDescriptorId).toBe(42);
    });

    it("Encodes a Protostream message", function (done) {
        root = protobuf.parse(myMsg).root;
        protobuf.loadSync(path.join(__dirname + '/../lib/protostream/message-wrapping.proto'), root);
        // Obtain message types
        var AwesomeMessage = root.lookupType("awesomepackage.AwesomeMessage");
        var WrappedMessage = root.lookupType("org.infinispan.protostream.WrappedMessage");

        // Build input message
        var payload = { awesomeField: "AwesomeString" };
        var errMsg = AwesomeMessage.verify(payload);
        expect(errMsg === null).toBeTruthy();
        var message = AwesomeMessage.create(payload);
        // Build manually WrappedMessage
        var buffer = AwesomeMessage.encode(message).finish();
        wmPayload = {
            wrappedContainerMessage: buffer,
            wrappedContainerTypeId: 42
        };
        errMsg = WrappedMessage.verify(wmPayload);
        expect(errMsg === null).toBeTruthy();
        var wmMessage = WrappedMessage.create(wmPayload);
        var expectedWMBuffer = WrappedMessage.encode(wmMessage).finish();

        // Call client API for encoding
        var outBuf = t.newByteBuf(32);
        p30.encodeMediaValue(message)(outBuf);
        // outBuf contains the WM encoded by the client

        var trimmed = outBuf.buf.slice(0, outBuf.offset);
        // check the client produces same byte buffer
        expect(Buffer.compare(trimmed, expectedWMBuffer)).toBe(0);

        done();
    });
}
);