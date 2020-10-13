var bitops = require('./bitops');
var utils = require('./utils');

var RESP = {};
var CLIENT_KEY = 'Client Key';
var SERVER_KEY = 'Server Key';


function Mechanism(options) {
    options = options || {};
    this._genNonce = options.genNonce || utils.genNonce;
    this._stage = 'initial';
}

// Conform to the SASL lib's expectations
Mechanism.Mechanism = Mechanism;


Mechanism.prototype.name = 'SCRAM-SHA-1';
Mechanism.prototype.clientFirst = true;


Mechanism.prototype.response = function (cred) {
    return RESP[this._stage](this, cred);
};

Mechanism.prototype.challenge = function (chal) {
    var values = utils.parse(chal);
    this._salt = Buffer.from(values.s, 'base64');
    this._iterationCount = parseInt(values.i, 10);
    this._nonce = values.r;
    this._verifier = values.v;
    this._error = values.e;
    this._challenge = chal;

    return this;
};


RESP.initial = function (mech, cred) {
    mech._cnonce = mech._genNonce();

    var authzid = '';
    if (cred.authzid) {
        authzid = 'a=' + utils.saslname(cred.authzid);
    }

    mech._gs2Header = 'n,' + authzid + ',';

    var nonce = 'r=' + mech._cnonce;
    var username = 'n=' + utils.saslname(cred.username || '');

    mech._clientFirstMessageBare = username + ',' + nonce;
    var result = mech._gs2Header + mech._clientFirstMessageBare;

    mech._stage = 'challenge';

    return result;
};


RESP.challenge = function (mech, cred) {
    var gs2Header = Buffer.from(mech._gs2Header).toString('base64');
    mech._clientFinalMessageWithoutProof = 'c=' + gs2Header + ',r=' + mech._nonce;

    var saltedPassword, clientKey, serverKey;

    // If our cached salt is the same, we can reuse cached credentials to speed
    // up the hashing process.
    if (cred.salt && Buffer.compare(cred.salt, mech._salt) === 0) {
        if (cred.clientKey && cred.serverKey) {
            clientKey = cred.clientKey;
            serverKey = cred.serverKey;
        } else if (cred.saltedPassword) {
            saltedPassword = cred.saltedPassword;
            clientKey = bitops.HMAC(saltedPassword, CLIENT_KEY);
            serverKey = bitops.HMAC(saltedPassword, SERVER_KEY);
        }
    } else {
        saltedPassword = bitops.Hi(cred.password || '', mech._salt, mech._iterationCount);
        clientKey = bitops.HMAC(saltedPassword, CLIENT_KEY);
        serverKey = bitops.HMAC(saltedPassword, SERVER_KEY);
    }

    var storedKey = bitops.H(clientKey);
    var authMessage = mech._clientFirstMessageBare + ',' +
                      mech._challenge + ',' +
                      mech._clientFinalMessageWithoutProof;
    var clientSignature = bitops.HMAC(storedKey, authMessage);

    var clientProof = bitops.XOR(clientKey, clientSignature).toString('base64');

    mech._serverSignature = bitops.HMAC(serverKey, authMessage);

    var result = mech._clientFinalMessageWithoutProof + ',p=' + clientProof;

    mech._stage = 'final';

    mech.cache = {
        salt: mech._salt,
        saltedPassword: saltedPassword,
        clientKey: clientKey,
        serverKey: serverKey
    };

    return result;
};

RESP.final = function () {
    // TODO: Signal errors
    return '';
};



module.exports = Mechanism;
