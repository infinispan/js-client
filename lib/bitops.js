var createHash = require('create-hash');
var createHmac = require('create-hmac');
var xor = require('bitwise-xor');


exports.XOR = xor;

exports.H = function (text) {
    return createHash('sha1').update(text).digest();
};

exports.HMAC = function (key, msg) {
    return createHmac('sha1', key).update(msg).digest();
};

exports.Hi = function (text, salt, iterations) {
    var ui1 = exports.HMAC(text, Buffer.from([salt, Buffer.from([0, 0, 0, 1], 'binary')]));
    var ui = ui1;
    for (var i = 0; i < iterations - 1; i++) {
        ui1 = exports.HMAC(text, ui1);
        ui = exports.XOR(ui, ui1);
    }

    return ui;
};

