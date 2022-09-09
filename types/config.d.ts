interface dataFormat{
    keyType : string,
    valueType : string
}
//TODO : Add option for key type and mediatype among the three

interface authentication{
    enabled: boolean,
    saslMechanism: string,
    userName: string,
    password: string,
    serverName: string,
}

export interface entry{
    key: mediaType,
    value: mediaType
}

export interface statsItem{
    STAT_NAME : string,
    STAT_VALUE : string
}

export type mediaType = string | number | object ;
//TODO: add type for protobuf instance

export interface addr{
    port : Number,
    host : String
}

export interface clientOpts{
    version ?: string,
    dataFormat ?: dataFormat,
    cacheName ?: string,
    authentication : authentication
}