(function() {

  var MSB = 0x80
      , REST = 0x7F
      , MSBALL = ~REST
      , INT = Math.pow(2, 31);

  var _ = require('underscore');
  var protobuf = require('protobufjs');
  var path = require('path');

  var f = require('./functional');
  var utils = require('./utils');

  var logger = utils.logger('codec');

  exports.encodeUByte = f.lift(doEncodeUByte, _.identity);
  exports.encodeVInt = f.lift(doEncodeVInt, _.identity);
  exports.encodeVLong = f.lift(doEncodeVLong, _.identity);
  exports.encodeJSON = f.lift(doEncodeJSON, _.identity);
  exports.encodeBytes = f.lift(doEncodeBytes, _.identity);
  exports.encodeBytesWithLength = f.lift(doEncodeBytesWithLength, _.identity);
  exports.encodeString = f.lift(doEncodeString, _.identity);
  exports.encodeSignedInt = f.lift(doEncodeSignedInt, _.identity);
  exports.encodeLong = f.lift(doEncodeLong, _.identity);
  exports.encodeProtobuf = f.lift(doEncodeProtobuf, _.identity);
  exports.encodeQuery = f.lift(doEncodeQuery,_.identity);

  exports.decodeUByte = f.lift(doDecodeUByte, _.identity);
  exports.decodeVInt = f.lift(doDecodeVInt, _.identity);
  exports.decodeLong = f.lift(doDecodeLong, _.identity);
  exports.decodeVLong = f.lift(doDecodeVLong, _.identity);
  exports.decodeJSON = f.lift(doDecodeJSON, _.identity);
  exports.decodeFixedBytes = f.lift(doDecodeFixedBytes, _.identity);
  exports.decodeString = f.lift(doDecodeString, _.identity);
  exports.decodeSignedInt = f.lift(doDecodeSignedInt, _.identity);
  exports.decodeVariableBytes = f.lift(doDecodeVariableBytes, _.identity);
  exports.decodeShort = f.lift(doDecodeShort, _.identity);
  exports.decodeProtobuf = f.lift(doDecodeProtobuf, _.identity);
  exports.decodeQuery = f.lift(doDecodeQuery,_.identity);

  exports.lastDecoded = function(values) {
    return values[0];
  };

  exports.allDecoded = function(expectedNumEntries) {
    return function(values) {
      if (values.length < expectedNumEntries) {
        logger.tracef('Not enough to read (not array): %s', values);
        return undefined;
      }

      return values;
    };
  };

  exports.bytesEncoded = function(values, state) {
    // If buffer is too big, slice it up so that it can be sent
    // immediately without any further modifications.
    var bytes = values[values.length - 1];
    if (bytes < state.buf.length)
      state.buf = state.buf.slice(0, bytes);

    return bytes;
  };

  /**
   * Encode an unsigned byte into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {number} num - The unsigned byte value to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeUByte(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteUByte(bytebuf))(num);
  }

  /**
   * Encode a variable-length integer into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {number} num - The integer value to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeVInt(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteVInt(bytebuf))(num);
  }

  /**
   * Encode a variable-length long into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {number} num - The long value to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeVLong(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteVLong(bytebuf))(num);
  }

  /**
   * Encode a JSON object into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {Object} obj - The object to JSON-encode.
   * @param {Function} typeId - The type identifier resolver function.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeJSON(bytebuf, obj, typeId) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteJSON(bytebuf, typeId))(obj);
  }

  /**
   * Encode a string into the buffer with a length prefix.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {string} obj - The string to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeString(bytebuf, obj) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteString(bytebuf))(obj);
  }

  /**
   * Encode raw bytes into the buffer without a length prefix.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {Buffer} bytes - The bytes to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeBytes(bytebuf, bytes) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteBytes(bytebuf))(bytes);
  }

  /**
   * Encode raw bytes into the buffer with a variable-length integer length prefix.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {Buffer} bytes - The bytes to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeBytesWithLength(bytebuf, bytes) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteBytesWithLength(bytebuf))(bytes);
  }

  /**
   * Encode a signed integer using zigzag encoding into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {number} num - The signed integer to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeSignedInt(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteSignedInt(bytebuf), zigZag)(num);
  }

  /**
   * Encode a signed 8-byte long integer into the buffer (big-endian).
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {number} num - The long value to encode (must be within safe integer range).
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeLong(bytebuf, num) {
    bytebuf = bytebufOverflowProtect(bytebuf, 8);
    var high = Math.floor(num / 4294967296);
    var low = num >>> 0;
    bytebuf.buf.writeInt32BE(high, bytebuf.offset);
    bytebuf.buf.writeUInt32BE(low, bytebuf.offset + 4);
    bytebuf.offset += 8;
    return bytebuf.offset;
  }

  /**
   * Encode a Protobuf message as length-prefixed bytes into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {Object} message - The Protobuf message to encode.
   * @param {Function} typeId - The type identifier resolver function.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeProtobuf(bytebuf, message, typeId) {
    return doEncodeBytesWithLength(bytebuf,encodeProtobuf(message,typeId));
  }

  /**
   * Create a function that encodes an object using the given Protobuf root type.
   * @param {Object} root - The Protobuf type used for encoding.
   * @returns {Function} A function that encodes an object to a Protobuf byte array.
   */
  function encodeProtobufInstance(root){
    return function(obj){
      return root.encode(obj).finish();
    };
  }

  /**
   * Encode a message as a Protobuf WrappedMessage.
   * @param {*} message - The message value to wrap and encode.
   * @param {Function} typeId - The type identifier resolver function.
   * @returns {Uint8Array} The encoded Protobuf bytes.
   */
  function encodeProtobuf(message,typeId){
    return _.compose(encodeProtobufInstance(WrappedMessage), createWrappedMessage)(message,typeId);
  }

  /**
   * Encode a Protobuf QueryRequest into the buffer with a length prefix.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {Object} query - The query request object to encode.
   * @returns {number} The new buffer offset after writing.
   */
  function doEncodeQuery(bytebuf,query){
    return doEncodeBytesWithLength(bytebuf,encodeProtobufInstance(Query.QueryRequest)(query));
  }

  /**
   * Create a WrappedMessage object from a value based on its type.
   * @param {*} message - The value to wrap (number, string, boolean, ArrayBuffer, or typed message).
   * @param {Function} typeId - The type identifier resolver for typed messages.
   * @returns {Object} The WrappedMessage descriptor object.
   */
  function createWrappedMessage(message,typeId){
    var wrappedMessage={};
    if(_.isNumber(message)){
      return f.merge(wrappedMessage,{'wrappedDouble':message});
    }
    if(_.isString(message)){
      return f.merge(wrappedMessage,{'wrappedString':message});
    }
    if(_.isBoolean(message)){
      return f.merge(wrappedMessage,{'wrappedBool':message});
    }
    if(_.isArrayBuffer(message)){
      return f.merge(wrappedMessage,{'wrappedBytes':message});
    }
    if(f.existy(message.$type)){
      var encodedMessage = encodeProtobufInstance(message.$type)(message);
      var messageTypeId = typeId(message.$type.fullName);
      return f.merge(wrappedMessage,{'wrappedMessage':encodedMessage},{'wrappedTypeId':messageTypeId});
    }
    throw new Error('Provide valid data types.');
  }

  /**
   * Apply zigzag encoding to a signed integer for variable-length encoding.
   * @param {number} num - The signed integer to zigzag-encode.
   * @returns {number} The zigzag-encoded value.
   */
  function zigZag(num) {
    return (num << 1) ^ (num >> 31);
  }

  var nullCheck = f.validator('must not be null', f.existy);
  var number = f.validator('must be a number', _.isNumber);
  var positiveOrZero = f.validator('must be >= 0', f.greaterThan(-1));
  var intTooBig = f.validator('must be less than 2^32', f.lessThan(Math.pow(2, 32)));
  var longTooBig = f.validator('must be less than 2^53 (javascript safe integer limitation)',
                               f.lessThan(Math.pow(2, 53)));
  var stringOrNullCheck = f.validator('must be a String or null', stringOrNull);

  /**
   * Check if a value is a string or null/undefined.
   * @param {*} x - The value to check.
   * @returns {boolean} True if the value is a string or null/undefined.
   */
  function stringOrNull(x) {
    return !f.existy(x) || _.isString(x);
  }

  /**
   * Create a validated unsigned byte writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes an unsigned byte.
   */
  function checkedWriteUByte(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero), uncheckedWriteUByte(bytebuf));
  }

  /**
   * Create a validated variable-length integer writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes a variable-length integer.
   */
  function checkedWriteVInt(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero, intTooBig), uncheckedWriteVNum(bytebuf));
  }

  /**
   * Create a validated variable-length long writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes a variable-length long.
   */
  function checkedWriteVLong(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero, longTooBig), uncheckedWriteVNum(bytebuf));
  }

  /**
   * Create a validated JSON writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @param {Function} typeId - The type identifier resolver function.
   * @returns {Function} A function that validates and writes a JSON object.
   */
  function checkedWriteJSON(bytebuf, typeId) {
    return f.partial1(f.condition1(nullCheck), uncheckedWriteJSON(bytebuf, typeId));
  }

  /**
   * Create a validated string writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes a string.
   */
  function checkedWriteString(bytebuf) {
    return f.partial1(f.condition1(stringOrNullCheck), uncheckedWriteString(bytebuf));
  }

  /**
   * Create a validated raw bytes writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes raw bytes.
   */
  function checkedWriteBytes(bytebuf) {
    return f.partial1(f.condition1(nullCheck), uncheckedWriteBytes(bytebuf));
  }

  /**
   * Create a validated length-prefixed bytes writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes length-prefixed bytes.
   */
  function checkedWriteBytesWithLength(bytebuf) {
    return f.partial1(f.condition1(nullCheck), uncheckedWriteBytesWithLength(bytebuf));
  }

  /**
   * Create a validated signed integer writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that validates and writes a signed integer.
   */
  function checkedWriteSignedInt(bytebuf) {
    return f.partial1(f.condition1(number, intTooBig), uncheckedWriteVNum(bytebuf));
  }

  /**
   * Create a function that updates the buffer's encoding offset.
   * @param {Object} bytebuf - The byte buffer whose offset to update.
   * @returns {Function} A function that sets the buffer offset and returns it.
   */
  function updateEncOffset(bytebuf) {
    return function(offset) {
      bytebuf.offset = offset;
      return offset;
    };
  }

  /**
   * Create an unchecked unsigned byte writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that writes a single byte and returns the new offset.
   */
  function uncheckedWriteUByte(bytebuf) {
    return function(byte) {
      bytebuf = bytebufOverflowProtect(bytebuf, 1);
      // TODO: We can better control validation, e.g. no boundary check but double size, so try passing noAssert=true
      bytebuf.buf.writeUInt8(byte, bytebuf.offset);
      return bytebuf.offset + 1;
    };
  }

  // TODO: Should create an ByteBuf type and move this logic there
  /**
   * Grow the byte buffer if there is not enough space for the given number of bytes.
   * @param {Object} bytebuf - The byte buffer to protect from overflow.
   * @param {number} maxSize - The maximum number of bytes needed.
   * @returns {Object} The byte buffer, potentially with a larger underlying buffer.
   */
  function bytebufOverflowProtect(bytebuf, maxSize) {
    if (bytebuf.offset + maxSize > bytebuf.buf.length) {
      var length = bytebuf.buf.length * 2;
      while (length < bytebuf.offset + maxSize)
        length = length * 2;

      var tmp = Buffer.alloc(length);
      bytebuf.buf.copy(tmp, 0, 0, bytebuf.buf.length);
      bytebuf.buf = tmp;
      return bytebuf;
    }
    return bytebuf;
  }

  /**
   * Create an unchecked variable-length number writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that writes a variable-length number and returns the new offset.
   */
  function uncheckedWriteVNum(bytebuf) {
    return function(num) {
      // Resize if not enough space to fit the biggest of var nums.
      // Due to Javascript limitations, the biggest var num is 2 ^ 53 - 1,
      // so at most 8 bytes will be needed.
      bytebuf = bytebufOverflowProtect(bytebuf, 8);

      var localOffset = bytebuf.offset;

      while(num >= INT) {
        bytebuf.buf.writeUInt8((num & 0xFF) | MSB, localOffset++);
        num /= 128;
      }
      while(num & MSBALL) {
        bytebuf.buf.writeUInt8((num & 0xFF) | MSB, localOffset++);
        num >>>= 7;
      }
      bytebuf.buf.writeUInt8(num | 0, localOffset);

      return localOffset + 1;
    };
  }

  /**
   * Create an unchecked JSON writer that serializes an object as a string into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that writes a JSON-serialized object and returns the new offset.
   */
  function uncheckedWriteJSON(bytebuf) {
    return function(obj) {
      return uncheckedWriteString(bytebuf)(JSON.stringify(obj));
    };
  }

  /**
   * Create an unchecked string writer that writes a length-prefixed string into the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that writes a string and returns the new offset.
   */
  function uncheckedWriteString(bytebuf) {
    return function(obj) {
      var stringNumBytes = f.existy(obj) ? Buffer.byteLength(obj) : 0;
      var offsetAfterBytes = doEncodeVInt(bytebuf, stringNumBytes);
      if (stringNumBytes > 0) {
        bytebuf = bytebufOverflowProtect(bytebuf, stringNumBytes);
        return bytebuf.buf.write(obj, offsetAfterBytes) + offsetAfterBytes;
      }
      return offsetAfterBytes;
    };
  }

  /**
   * Create an unchecked raw bytes writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that writes raw bytes and returns the new offset.
   */
  function uncheckedWriteBytes(bytebuf) {
    return function(bytes) {
      bytebuf = bytebufOverflowProtect(bytebuf, bytes.length);
      var targetStart = bytebuf.offset;
      bytes.copy(bytebuf.buf, targetStart);
      return targetStart + bytes.length;
    };
  }

  /**
   * Create an unchecked length-prefixed bytes writer for the buffer.
   * @param {Object} bytebuf - The byte buffer to write to.
   * @returns {Function} A function that writes length-prefixed bytes and returns the new offset.
   */
  function uncheckedWriteBytesWithLength(bytebuf) {
    return function(bytes) {
      var buffNumBytes = f.existy(bytes) ? Buffer.byteLength(bytes) : 0;
      doEncodeVInt(bytebuf, buffNumBytes);
      if (buffNumBytes > 0) {
        bytebuf = bytebufOverflowProtect(bytebuf, bytes.length);
        var targetStart = bytebuf.offset;
        bytes.copy(bytebuf.buf, targetStart);
      }
      return targetStart + buffNumBytes;
    };
  }

  /**
   * Decode an unsigned byte from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {number|undefined} The decoded unsigned byte, or undefined if not enough data.
   */
  function doDecodeUByte(bytebuf) {
    return uncheckedReadUByte(bytebuf)();
  }

  /**
   * Decode a variable-length integer from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {number|undefined} The decoded integer, or undefined if not enough data.
   */
  function doDecodeVInt(bytebuf) {
    return uncheckedReadVNum(bytebuf)();
  }

  /**
   * Decode a variable-length long from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {number|undefined} The decoded long, or undefined if not enough data.
   */
  function doDecodeVLong(bytebuf) {
    return uncheckedReadVNum(bytebuf)();
  }

  /**
   * Decode a fixed-width 8-byte long from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {number|undefined} The decoded long, or undefined if not enough data.
   */
  function doDecodeLong(bytebuf) {
    return uncheckedReadLong(bytebuf)();
  }

  /**
   * Decode a JSON object from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Object} The decoded JSON object.
   */
  function doDecodeJSON(bytebuf) {
    return uncheckedReadJSON(bytebuf);
  }

  /**
   * Decode a fixed number of bytes from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @param {number} num - The number of bytes to read.
   * @returns {Buffer} The decoded bytes.
   */
  function doDecodeFixedBytes(bytebuf, num) {
    return uncheckedReadBytes(bytebuf)(num);
  }

  /**
   * Decode a length-prefixed string from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {string|undefined} The decoded string, or undefined if not enough data.
   */
  function doDecodeString(bytebuf) {
    return uncheckedReadString(bytebuf)();
  }

  /**
   * Decode a zigzag-encoded signed integer from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {number|undefined} The decoded signed integer, or undefined if not enough data.
   */
  function doDecodeSignedInt(bytebuf) {
    var num = uncheckedReadVNum(bytebuf)();
    if (!f.existy(num))
      return undefined;
    
    return (num & 1) == 0 ? num >>> 1 : ~(num >>> 1);
  }

  /**
   * Decode a variable-length prefixed byte array from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Buffer} The decoded bytes.
   */
  function doDecodeVariableBytes(bytebuf) {
    return _.compose(uncheckedReadBytes(bytebuf), uncheckedReadVNum(bytebuf))();
  }

  /**
   * Decode an unsigned 16-bit short from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {number} The decoded short value.
   */
  function doDecodeShort(bytebuf) {
    return uncheckedReadShort(bytebuf)();
  }

  /**
   * Decode a Protobuf WrappedMessage from the buffer and unwrap it.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @param {Function} protostreamTypename - Resolver from type ID to type name.
   * @param {Function} root - Resolver from type name to Protobuf root type.
   * @returns {*} The unwrapped decoded value.
   */
  function doDecodeProtobuf(bytebuf,protostreamTypename,root){
    var wrappedObject = _.compose(decodeProtobufMessage(WrappedMessage),trimBytebuf)(bytebuf);
    return unwrapWrappedMessage(wrappedObject,protostreamTypename,root);
  }

  /**
   * Unwrap a WrappedMessage object into its underlying value based on the wrapped field type.
   * @param {Object} wrappedObject - The decoded WrappedMessage Protobuf object.
   * @param {Function} protostreamTypename - Resolver from type ID to type name.
   * @param {Function} root - Resolver from type name to Protobuf root type.
   * @returns {*} The unwrapped value (number, string, boolean, bytes, or decoded message).
   */
  function unwrapWrappedMessage(wrappedObject,protostreamTypename,root){
    switch(true){
      case _.has(wrappedObject,'wrappedDouble'):
        return wrappedObject.wrappedDouble;
      case _.has(wrappedObject,'wrappedString'):
        return wrappedObject.wrappedString;
      case _.has(wrappedObject,'wrappedBool'):
        return wrappedObject.wrappedBool;
      case _.has(wrappedObject,'wrappedBytes'):
        return wrappedObject.wrappedBytes;
      case _.has(wrappedObject,'wrappedMessage'):
        var messageBytes= wrappedObject.wrappedMessage;
        var protobufRoot = findRootByTypeId(protostreamTypename,root)(wrappedObject.wrappedTypeId);
        return decodeProtobufMessage(protobufRoot)(messageBytes);
    }
  }

  /**
   * Create a function that decodes a Protobuf message using the given root type.
   * @param {Object} root - The Protobuf type used for decoding.
   * @returns {Function} A function that decodes bytes into a Protobuf message.
   */
  function decodeProtobufMessage(root){
    return function(bytebuf){
      return root.decode(bytebuf);
    };
  }

  /**
   * Create a function that resolves a Protobuf root type from a wrapped type ID.
   * @param {Function} protostreamTypename - Resolver from type ID to type name.
   * @param {Function} root - Resolver from type name to Protobuf root type.
   * @returns {Function} A function that takes a type ID and returns the Protobuf root type.
   */
  function findRootByTypeId(protostreamTypename,root){
    return function(wrappedTypeId){
      return _.compose(root,protostreamTypename)(wrappedTypeId);
    }; 
  }

  /**
   * Extract and return a slice of bytes from the buffer, advancing the offset.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @param {number} [length] - The number of bytes to extract; decoded as a VInt if omitted.
   * @returns {Buffer} The extracted byte slice.
   */
  function trimBytebuf(bytebuf,length){
    if(!f.existy(length)) length = doDecodeVInt(bytebuf);
    var retBuf = bytebuf.buf.slice(bytebuf.offset, bytebuf.offset + length);
    bytebuf.offset += length;
    return retBuf;
  }

  /**
   * Decode a Protobuf QueryResponse from the buffer and unwrap the results.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @param {Function} protostreamTypename - Resolver from type ID to type name.
   * @param {Function} root - Resolver from type name to Protobuf root type.
   * @returns {Array} The decoded query results, with or without projections.
   */
  function doDecodeQuery(bytebuf,protostreamTypename,root){
    var queryResponse = decodeProtobufMessage(Query.QueryResponse)(trimBytebuf(bytebuf));
    var queryResults = queryResponse.results;
    var projectionSize = queryResponse.projectionSize;
    return f.greaterThan(0)(projectionSize) ? unwrapQueryWithProj(queryResults,projectionSize) :  unwrapQueryWithoutProj(queryResults,protostreamTypename,root);
  }

  /**
   * Decode and unwrap the wrappedBytes field from a query result entry.
   * @param {Object} result - A query result containing a wrappedBytes field.
   * @param {Function} protostreamTypename - Resolver from type ID to type name.
   * @param {Function} root - Resolver from type name to Protobuf root type.
   * @returns {*} The unwrapped decoded value.
   */
  function decodeWrappedBytes(result,protostreamTypename,root){
    return _.compose(f.curry3(unwrapWrappedMessage)(root)(protostreamTypename),decodeProtobufMessage(WrappedMessage))(result.wrappedBytes);
  }

  /**
   * Unwrap query results that have no projections by decoding each result's wrapped bytes.
   * @param {Array} queryResults - The array of raw query result entries.
   * @param {Function} protostreamTypeName - Resolver from type ID to type name.
   * @param {Function} root - Resolver from type name to Protobuf root type.
   * @returns {Array} The array of decoded result values.
   */
  function unwrapQueryWithoutProj(queryResults,protostreamTypeName,root){
    return queryResults.map(f.curry3(decodeWrappedBytes)(root)(protostreamTypeName));
  }

  /**
   * Unwrap query results with projections by grouping values into arrays of projection size.
   * @param {Array} queryResults - The array of raw query result entries.
   * @param {number} projectionSize - The number of projection columns per result row.
   * @returns {Array<Array>} The array of result rows, each containing projection values.
   */
  function unwrapQueryWithProj(queryResults,projectionSize){
    return _.reduce(queryResults,function(acc,cur,i){
      return ((i%projectionSize) ? acc[acc.length-1].push(_.values(cur)[0]) : acc.push([_.values(cur)[0]])) && acc;
    },[]);
  }

  /**
   * Create an unchecked unsigned byte reader for the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Function} A function that reads a single unsigned byte, or undefined if not enough data.
   */
  function uncheckedReadUByte(bytebuf) {
    return function() {
      if (1 > bytebuf.buf.length - bytebuf.offset) {
        logger.tracef('Can not fully read unsigned byte (buffer size is %d, buffer offset %d)',
                      bytebuf.buf.length, bytebuf.offset);
        return undefined;
      }

      return bytebuf.buf.readUInt8(bytebuf.offset++);
    };
  }

  /**
   * Create an unchecked variable-length number reader for the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Function} A function that reads a variable-length number, or undefined if not enough data.
   */
  function uncheckedReadVNum(bytebuf) {
    return function() {
      var res = 0, shift  = 0, b;

      do {
        if (1 > bytebuf.buf.length - bytebuf.offset) {
          logger.tracef('Can not fully read unsigned byte (buffer size is %d, buffer offset %d)',
                        bytebuf.buf.length, bytebuf.offset);
          return undefined;
        }

        b = bytebuf.buf.readUInt8(bytebuf.offset++);
        res += shift < 28
            ? (b & REST) << shift
            : (b & REST) * Math.pow(2, shift);
        shift += 7;
      } while (b >= MSB);

      return res;
    };
  }

  /**
   * Create an unchecked fixed-width 8-byte long reader for the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Function} A function that reads a long, or undefined if not enough data.
   */
  function uncheckedReadLong(bytebuf) {
    return function() {
      if (8 > bytebuf.buf.length - bytebuf.offset) {
        logger.tracef('Can not fully read 8 bytes (buffer size is %d, buffer offset %d)',
                      bytebuf.buf.length, bytebuf.offset);
        return undefined;
      }

      var low = bytebuf.buf.readInt32BE(bytebuf.offset + 4);
      var n = bytebuf.buf.readInt32BE(bytebuf.offset) * 4294967296.0 + low;
      if (low < 0) n += 4294967296;
      bytebuf.offset = bytebuf.offset + 8;
      return n;
    };
  }

  /**
   * Create an unchecked fixed-length byte reader for the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Function} A function that reads a given number of bytes as a Buffer.
   */
  function uncheckedReadBytes(bytebuf) {
    return function(num) {
      var end = bytebuf.offset + num;
      var bytes = bytebuf.buf.slice(bytebuf.offset, end);
      bytebuf.offset = end;
      return bytes;
    };
  }

  /**
   * Read and parse a JSON object from the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Object} The parsed JSON object, or an empty object if the string is empty.
   */
  function uncheckedReadJSON(bytebuf) {
    var str = uncheckedReadString(bytebuf)();
    logger.tracef('Read object as string: \'%s\'', str);
    var obj = _.isEmpty(str) ? {} : JSON.parse(str);
    logger.tracef('Returning JSON object: %s', JSON.stringify(obj));
    return obj;
  }

  /**
   * Create an unchecked length-prefixed string reader for the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Function} A function that reads a string, or undefined if not enough data.
   */
  function uncheckedReadString(bytebuf) {
    return function() {
      var numBytes = uncheckedReadVNum(bytebuf)();
      if (!f.existy(numBytes))
        return undefined;

      if (numBytes > bytebuf.buf.length - bytebuf.offset) {
        logger.tracef('Can not fully read object with %d bytes (buffer size is %d, buffer offset %d)',
                      numBytes, bytebuf.buf.length, bytebuf.offset);
        return undefined;
      }

      var obj = bytebuf.buf.toString(undefined, bytebuf.offset, bytebuf.offset + numBytes);
      bytebuf.offset = bytebuf.offset + numBytes;
      return obj;
    };
  }

  /**
   * Create an unchecked unsigned 16-bit short reader for the buffer.
   * @param {Object} bytebuf - The byte buffer to read from.
   * @returns {Function} A function that reads a big-endian unsigned short.
   */
  function uncheckedReadShort(bytebuf) {
    return function() {
      var numBytes = bytebuf.buf.readUInt16BE(bytebuf.offset);
      bytebuf.offset = bytebuf.offset + 2;
      return numBytes;
    };
  }

  var WrappedMessage = (function() {
    var root=protobuf.loadSync(path.join(`${__dirname}/protostream/message-wrapping.proto`));

    var wrappedMessage = root.lookupType('org.infinispan.protostream.WrappedMessage');

    return wrappedMessage;
  }());

  var Query = (function() {
    var root=protobuf.loadSync(path.join(`${__dirname}/protostream/query.proto`));
    protobuf.loadSync(path.join(`${__dirname}/protostream/message-wrapping.proto`),root); //loaded the wrappedMessage.proto to the root
    var QueryRequest = root.lookupType('org.infinispan.query.remote.client.QueryRequest');
    var QueryResponse = root.lookupType('org.infinispan.query.remote.client.QueryResponse');
    var ContinuousQueryResult = root.lookupType('org.infinispan.query.remote.client.ContinuousQueryResult');

    return {
      QueryRequest,
      QueryResponse,
      ContinuousQueryResult
    };
  }());

  var CQ_RESULT_TYPES = ['leaving', 'joining', 'updated'];

  /**
   * Wrap a scalar value as a WrappedMessage byte array.
   * @param {string|number|boolean} value - The value to wrap.
   * @returns {Buffer} The encoded WrappedMessage bytes.
   */
  exports.wrapScalar = function(value) {
    return WrappedMessage.encode(createWrappedMessage(value, _.identity)).finish();
  };

  /**
   * Decode a ContinuousQueryResult from raw protobuf bytes.
   * @param {Buffer} bytes - The raw ContinuousQueryResult bytes.
   * @returns {Object} Decoded result with resultType, key, value, projection.
   */
  exports.decodeContinuousQueryResult = function(bytes) {
    var msg = Query.ContinuousQueryResult.decode(bytes);
    return {
      resultType: CQ_RESULT_TYPES[msg.resultType] || 'leaving',
      key: msg.key,
      value: msg.value,
      projection: msg.projection
    };
  };

  /**
   * Decode a WrappedMessage from raw bytes.
   * @param {Buffer} bytes - The raw WrappedMessage bytes.
   * @returns {Object} The decoded WrappedMessage object.
   */
  exports.decodeWrappedMessage = function(bytes) {
    return WrappedMessage.decode(bytes);
  };

}.call(this));
