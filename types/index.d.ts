import * as config from "./config"

interface client {
    connect(): Promise<any>,
    disconnect(): Promise<any>,
    get(key: config.mediaType): Promise<config.mediaType>,
    query(query: object): Promise<Object[]>,
    //TODO: add type for query object and its return type 
    containsKey(key: config.mediaType): Promise<boolean>,
    getWithMetadata(key: config.mediaType): Promise<object>,
    //TODO: add type for its return type
    put(key: config.mediaType, value: config.mediaType, options?: object): Promise<config.mediaType>,
    //TODO: add type for its options
    remove(key: config.mediaType, options?: object): Promise<boolean | string | object>,
    //TODO: add type for its options and its return type
    putIfAbsent(key: config.mediaType, value: config.mediaType,options?: object): Promise<boolean|string|object>,
    //TODO: add type for its options and its return type
    replace(key: config.mediaType, value: config.mediaType,options?: object): Promise<boolean|string|object>,
    //TODO: add type for its options and its return type
    replaceWithVersion(key: config.mediaType, value: config.mediaType, version:Buffer, options?: object): Promise<boolean|string|object>,
    //TODO: add type for its options and its return type
    removeWithVersion(key: config.mediaType, value: config.mediaType, version:Buffer, options?: object): Promise<boolean|string|object>,
    //TODO: add type for its options and its return type
    getAll(keys: config.mediaType[]): Promise<config.entry[]>,
    putAll(pairs: config.entry[], options?: object): Promise<any>,
    //TODO: add type for its options
    iterator(batchSize: number, options?: object): Promise<any>,
    //TODO: add type for its options and for iterator
    size(): Promise<number>,
    clear(): Promise<any>,
    ping(): Promise<any>,
    stats(): Promise<config.statsItem[]>,
    addListener(event: string, listener: any, options?: any): Promise<string>,
    //TODO: add type for its options and listener
    removeListener(listenerId: string): Promise<any>,
    addScript(scriptName: string, script: string): Promise<any>,
    execute(scriptName: string, params: any): Promise<string|string[]>,
    //TODO: add type for its params
    getTopologyInfo(): any,
    //TODO: add type for its return type
    toString(): string,
    registerProtostreamType(typeName: string, descriptorId: number): object,
    //TODO: add type for its options and its return type
    registerProtostreamRoot(root: object): object
    //TODO: add type for root
}

export function client(addr: config.addr | config.addr[], clientOpts: config.clientOpts): Promise<client>;
