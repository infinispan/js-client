export function client(args: {
    /**
     * - Server host name.
     */
    host: string;
    /**
     * - Server port.
     */
    port: number;
} | {
    /**
     * - Server host name.
     */
    host: string;
    /**
     * - Server port.
     */
    port: number;
}[], options: any): any;
export function Client(addrs: any, clientOpts: any): {
    connect: () => any;
    /**
     * Disconnect client from backend server(s).
     *
     * @returns {module:promise.Promise}
     * A promise that will be completed once client has
     * completed disconnection from server(s).
     * @memberof Client#
     * @since 0.3
     */
    disconnect: () => any;
    /**
     * Get the value associated with the given key parameter.
     *
     * @param k {(String|Object)} Key to retrieve.
     * @returns {module:promise.Promise.<?String>}
     * A promise that will be completed with the value associated with
     * the key, or undefined if the value is not present.
     * @memberof Client#
     * @since 0.3
     */
    get: (k: (string | any)) => any;
    /**
     * Query the server with the given queryString.
     *
     * @param q {(Object)} query to retrieve.
     * @returns {module:promise.Promise.<?Object[]>}
     * A promise that will be completed with the array of values associated with
     * the query, or empty array if the no values matches the query.
     * @memberof Client#
     * @since 1.3
     */
    query: (q: (any)) => any;
    /**
     * Check whether the given key is present.
     *
     * @param k {(String|Object)} Key to check for presence.
     * @returns {module:promise.Promise.<boolean>}
     * A promise that will be completed with true if there is a value
     * associated with the key, or false otherwise.
     * @memberof Client#
     * @since 0.3
     */
    containsKey: (k: (string | any)) => any;
    /**
     * Metadata value.
     *
     * @typedef {Object} MetadataValue
     * @property {(String|Object)} value - Value associated with the key
     * @property {Buffer} version - Version of the value as a byte buffer.
     * @property {Number} lifespan - Lifespan of entry, defined in seconds.
     * If the entry is immortal, it would be -1.
     * @property {Number} maxIdle - Max idle time of entry, defined in seconds.
     * If the entry is no transient, it would be -1.
     * @since 0.3
     */
    /**
     * Get the value and metadata associated with the given key parameter.
     *
     * @param k {(String|Object)} Key to retrieve.
     * @returns {module:promise.Promise.<?MetadataValue>}
     * A promise that will be completed with the value and metadata
     * associated with the key, or undefined if the value is not present.
     * @memberof Client#
     * @since 0.3
     */
    getWithMetadata: (k: (string | any)) => any;
    /**
     * A String formatted to specify duration unit information.
     * Duration unit is formed of two elements, the first is the number of
     * units, and the second is the unit itself: 's' for seconds, 'ms' for
     * milliseconds, 'ns' for nanoseconds, 'μs' for microseconds, 'm' for
     * minutes, 'h' for hours and 'd' for days.
     * So, for example: '1s' would be one second, '5h' five hours...etc.
     *
     * @typedef {String} DurationUnit
     * @since 0.3
     */
    /**
     * Store options defines a set of optional parameters that can be
     * passed when storing data.
     *
     * @typedef {Object} StoreOptions
     * @property {Boolean} previous - Indicates whether previous value
     * should be returned. If no previous value exists, it would return
     * undefined.
     * @property {DurationUnit} lifespan -
     * Lifespan for the stored entry.
     * @property {DurationUnit} maxIdle -
     * Max idle time for the stored entry.
     * @since 0.3
     */
    /**
     * Associates the specified value with the given key.
     *
     * @param k {(String|Object)} Key with which the specified value is to be associated.
     * @param v {(String|Object)} Value to be associated with the specified key.
     * @param opts {?StoreOptions} Optional store options.
     * @returns {module:promise.Promise.<?(String|Object)>}
     * A promise that will be completed with undefined unless 'previous'
     * option has been enabled and a previous value exists, in which case it
     * would return the previous value.
     * @memberof Client#
     * @since 0.3
     */
    put: (k: (string | any), v: (string | any), opts: {
        /**
         * - Indicates whether previous value
         * should be returned. If no previous value exists, it would return
         * undefined.
         */
        previous: boolean;
        /**
         * -
         * Lifespan for the stored entry.
         */
        lifespan: string;
        /**
         * -
         * Max idle time for the stored entry.
         */
        maxIdle: string;
    }) => any;
    /**
     * Remove options defines a set of optional parameters that can be
     * passed when removing data.
     *
     * @typedef {Object} RemoveOptions
     * @property {Boolean} previous - Indicates whether previous value
     * should be returned. If no previous value exists, it would return
     * undefined.
     * @since 0.3
     */
    /**
     * Removes the mapping for a key if it is present.
     *
     * @param k {(String|Object)} Key whose mapping is to be removed.
     * @param opts {?RemoveOptions} Optional remove options.
     * @returns {module:promise.Promise.<(Boolean|String|Object)>}
     * A promise that will be completed with true if the mapping was removed,
     * or false if the key did not exist.
     * If the 'previous' option is enabled, it returns the value
     * before removal or undefined if the key did not exist.
     * @memberof Client#
     * @since 0.3
     */
    remove: (k: (string | any), opts: {
        /**
         * - Indicates whether previous value
         * should be returned. If no previous value exists, it would return
         * undefined.
         */
        previous: boolean;
    }) => any;
    /**
     * Conditional store operation that associates the key with the given
     * value if the specified key is not already associated with a value.
     *
     * @param k {(String|Object)} Key with which the specified value is to be associated.
     * @param v {(String|Object)} Value to be associated with the specified key.
     * @param opts {?StoreOptions} Optional store options.
     * @returns {module:promise.Promise.<(Boolean|String|Object)>}
     * A promise that will be completed with true if the mapping was stored,
     * or false if the key is already present.
     * If the 'previous' option is enabled, it returns the existing value
     * or undefined if the key does not exist.
     * @memberof Client#
     * @since 0.3
     */
    putIfAbsent: (k: (string | any), v: (string | any), opts: {
        /**
         * - Indicates whether previous value
         * should be returned. If no previous value exists, it would return
         * undefined.
         */
        previous: boolean;
        /**
         * -
         * Lifespan for the stored entry.
         */
        lifespan: string;
        /**
         * -
         * Max idle time for the stored entry.
         */
        maxIdle: string;
    }) => any;
    /**
     * Conditional store operation that replaces the entry for a key only
     * if currently mapped to a given value.
     *
     * @param k {(String|Object)} Key with which the specified value is associated.
     * @param v {(String|Object)} Value expected to be associated with the specified key.
     * @param opts {?StoreOptions} Optional store options.
     * @returns {module:promise.Promise.<(Boolean|String|Object)>}
     * A promise that will be completed with true if the mapping was replaced,
     * or false if the key does not exist.
     * If the 'previous' option is enabled, it returns the value that was
     * replaced or undefined if the key did not exist.
     * @memberof Client#
     * @since 0.3
     */
    replace: (k: (string | any), v: (string | any), opts: {
        /**
         * - Indicates whether previous value
         * should be returned. If no previous value exists, it would return
         * undefined.
         */
        previous: boolean;
        /**
         * -
         * Lifespan for the stored entry.
         */
        lifespan: string;
        /**
         * -
         * Max idle time for the stored entry.
         */
        maxIdle: string;
    }) => any;
    /**
     * Replaces the given value only if its version matches the supplied
     * version.
     *
     * @param k {(String|Object)} Key with which the specified value is associated.
     * @param v {(String|Object)} Value expected to be associated with the specified key.
     * @param version {Buffer} binary buffer version that should match the
     * one in the server for the operation to succeed. Version information
     * can be retrieved with getWithMetadata method.
     * @param opts {?StoreOptions} Optional store options.
     * @returns {module:promise.Promise.<(Boolean|String|Object)>}
     * A promise that will be completed with true if the version matches
     * and the mapping was replaced, otherwise it returns false if not
     * replaced because key does not exist or version sent does not match
     * server-side version.
     * If the 'previous' option is enabled, it returns the value that was
     * replaced if the version matches. If the version does not match, the
     * current value is returned. Fianlly if the key did not exist it
     * returns undefined.
     * @memberof Client#
     * @since 0.3
     */
    replaceWithVersion: (k: (string | any), v: (string | any), version: Buffer, opts: {
        /**
         * - Indicates whether previous value
         * should be returned. If no previous value exists, it would return
         * undefined.
         */
        previous: boolean;
        /**
         * -
         * Lifespan for the stored entry.
         */
        lifespan: string;
        /**
         * -
         * Max idle time for the stored entry.
         */
        maxIdle: string;
    }) => any;
    /**
     * Removes the given entry only if its version matches the
     * supplied version.
     *
     * @param k {(String|Object)} Key whose mapping is to be removed.
     * @param version {Buffer} binary buffer version that should match the
     * one in the server for the operation to succeed. Version information
     * can be retrieved with getWithMetadata method.
     * @param opts {?RemoveOptions} Optional remove options.
     * @returns {module:promise.Promise.<(Boolean|String|Object)>}
     * A promise that will be completed with true if the version matches
     * and the mapping was removed, otherwise it returns false if not
     * removed because key does not exist or version sent does not match
     * server-side version.
     * If the 'previous' option is enabled, it returns the value that was
     * removed if the version matches. If the version does not match, the
     * current value is returned. Fianlly if the key did not exist it
     * returns undefined.
     * @memberof Client#
     * @since 0.3
     */
    removeWithVersion: (k: (string | any), version: Buffer, opts: {
        /**
         * - Indicates whether previous value
         * should be returned. If no previous value exists, it would return
         * undefined.
         */
        previous: boolean;
    }) => any;
    /**
     * Key/value entry.
     *
     * @typedef {Object} Entry
     * @property {(String|Object)} key - Entry's key.
     * @property {(String|Object)} value - Entry's value.
     * @since 0.3
     */
    /**
     * Retrieves all of the entries for the provided keys.
     *
     * @param keys {(String[]|Object[])} Keys to find values for.
     * @returns {module:promise.Promise.<Entry[]>}
     * A promise that will be completed with an array of entries for all
     * keys found. If a key does not exist, there won't be an entry for that
     * key in the returned array.
     * @memberof Client#
     * @since 0.3
     */
    getAll: (keys: (string[] | any[])) => any;
    /**
     * Multi store options defines a set of optional parameters that can be
     * passed when storing multiple entries.
     *
     * @typedef {Object} MultiStoreOptions
     * @property {DurationUnit} lifespan -
     * Lifespan for the stored entry.
     * @property {DurationUnit} maxIdle -
     * Max idle time for the stored entry.
     * @since 0.3
     */
    /**
     * Stores all of the mappings from the specified entry array.
     *
     * @param pairs {Entry[]} key/value pair mappings to be stored
     * @param opts {MultiStoreOptions}
     * Optional storage options to apply to all entries.
     * @returns {module:promise.Promise}
     * A promise that will be completed when all entries have been stored.
     * @memberof Client#
     * @since 0.3
     */
    putAll: (pairs: {
        /**
         * - Entry's key.
         */
        key: (string | any);
        /**
         * - Entry's value.
         */
        value: (string | any);
    }[], opts: {
        /**
         * -
         * Lifespan for the stored entry.
         */
        lifespan: string;
        /**
         * -
         * Max idle time for the stored entry.
         */
        maxIdle: string;
    }) => any;
    /**
     * Iterator options defines a set of optional parameters that
     * control how iteration occurs and the data that's iterated over.
     *
     * @typedef {Object} IteratorOptions
     * @property {Boolean} metadata - Indicates whether entries iterated
     * over also expose metadata information. This option is false by
     * default which means no metadata information is exposed on iteration.
     * @since 0.3
     */
    /**
     * Iterate over the entries stored in server(s).
     *
     * @param batchSize {Number}
     * The number of entries transferred from the server at a time.
     * @param opts {?IteratorOptions} Optional iteration settings.
     * @return {module:promise.Promise.<Iterator>}
     * A promise that will be completed with an iterator that can be used
     * to retrieve stored elements.
     * @memberof Client#
     * @since 0.3
     */
    iterator: (batchSize: number, opts: {
        /**
         * - Indicates whether entries iterated
         * over also expose metadata information. This option is false by
         * default which means no metadata information is exposed on iteration.
         */
        metadata: boolean;
    }) => any;
    /**
     * Count of entries in the server(s).
     *
     * @returns {module:promise.Promise.<Number>}
     * A promise that will be completed with the number of entries stored.
     * @memberof Client#
     * @since 0.3
     */
    size: () => any;
    /**
     * Clear all entries stored in server(s).
     *
     * @returns {module:promise.Promise}
     * A promise that will be completed when the clear has been completed.
     * @memberof Client#
     * @since 0.3
     */
    clear: () => any;
    /**
     * Pings the server(s).
     *
     * @returns {module:promise.Promise}
     * A promise that will be completed when ping response was received.
     * @memberof Client#
     * @since 0.3
     */
    ping: () => any;
    /**
     * Statistic item.
     *
     * @typedef {Object} StatsItem
     * @property {String} STAT_NAME -
     * Name of the statistic.
     * @property {String} STAT_VALUE -
     * Value of the statistic.
     * @since 0.3
     */
    /**
     * Retrieve various statistics from server(s).
     *
     * @returns {module:promise.Promise<StatsItem[]>}
     * A promise that will be completed with an array of statistics, where
     * each element will have a single property. This single property will
     * have the statistic name as property name and statistic value as
     * property value.
     * @memberof Client#
     * @since 0.3
     */
    stats: () => any;
    /**
     * Listener options.
     *
     * @typedef {Object} ListenOptions
     * @property {String} listenerId - Listener identifier can be passed
     * in as parameter to register multiple event callback functions for
     * the same listener.
     * @since 0.3
     */
    /**
     * Add an event listener.
     *
     * @param {String} event
     * Event to add listener to. Possible values are:
     * 'create', 'modify', 'remove' and 'expiry'.
     * @param {Function} listener
     * Function to invoke when the listener event is received.
     * 'create' and 'modify' events callback the function with key,
     * entry version and listener id.
     * 'remove' and 'expiry' events callback the function with key
     * and listener id.
     * @param opts {?ListenOptions} Options for adding listener.
     * @returns {module:promise.Promise<String>}
     * A promise that will be completed with the identifier of the listener.
     * This identifier can be used to register multiple callbacks with the
     * same listener, or to remove the listener.
     * @memberof Client#
     * @since 0.3
     */
    addListener: (event: string, listener: Function, opts: {
        /**
         * - Listener identifier can be passed
         * in as parameter to register multiple event callback functions for
         * the same listener.
         */
        listenerId: string;
    }) => any;
    /**
     * Remove an event listener.
     *
     * @param {String} listenerId
     * Listener identifier to identify listener to remove.
     * @return {module:promise.Promise}
     * A promise that will be completed when the listener has been removed.
     * @memberof Client#
     * @since 0.3
     */
    removeListener: (listenerId: string) => any;
    /**
     * Add script to server(s).
     *
     * @param {String} scriptName Name of the script to store.
     * @param {String} script Script to store in server.
     * @return {module:promise.Promise}
     * A promise that will be completed when the script has been stored.
     * @memberof Client#
     * @since 0.3
     */
    addScript: (scriptName: string, script: string) => any;
    /**
     * Script execution parameters.
     *
     * @typedef {Object} ExecParams
     * @property {String} PARAM_NAME -
     * Name of the parameter.
     * @property {String} PARAM_VALUE -
     * Value of the parameter.
     * @since 0.3
     */
    /**
     * Execute the named script passing in optional parameters.
     *
     * @param {String} scriptName Name of the script to execute.
     * @param {?ExecParams[]} params
     * Optional array of named parameters to pass to script in server.
     * @returns {module:promise.Promise<String|String[]>}
     * A promise that will be completed with either the value returned by the
     * script after execution for local scripts, or an array of values
     * returned by the script when executed in multiple servers for
     * distributed scripts.
     * @memberof Client#
     * @since 0.3
     */
    execute: (scriptName: string, params: {
        /**
         * -
         * Name of the parameter.
         */
        PARAM_NAME: string;
        /**
         * -
         * Value of the parameter.
         */
        PARAM_VALUE: string;
    }[]) => any;
    /**
     * Get server topology related information.
     *
     * @returns {TopologyInfo}
     * An object instance that can be used to query diverse information
     * related to the server topology information.
     * @memberof Client#
     * @since 0.3
     */
    getTopologyInfo: () => (transport: any) => {
        /**
         * Get the server topology identifier.
         *
         * @returns {Number} Topology identifier.
         * @memberof Topology#
         * @since 0.3
         */
        getTopologyId: () => number;
        /**
         * Get the list of servers that the client is currently connected to.
         *
         * @return {ServerAddress[]} An array of server addresses.
         * @memberof Topology#
         * @since 0.3
         */
        getMembers: () => {
            /**
             * - Server host name.
             */
            host: string;
            /**
             * - Server port.
             */
            port: number;
        }[];
        /**
         * Find the list of server addresses that are owners for a given key.
         *
         * @param {(String|Object)} k Key to find owners for.
         * @return {ServerAddress[]}
         * An array of server addresses that are owners for the given key.
         * @memberof Topology#
         * @since 0.3
         */
        findOwners: (k: (string | any)) => {
            /**
             * - Server host name.
             */
            host: string;
            /**
             * - Server port.
             */
            port: number;
        }[];
        /**
         * Switch remote cache manager to a different cluster,
         * previously declared via configuration.
         *
         * @param clusterName name of the cluster to which to switch to
         * @return {module:promise.Promise<Boolean>}
         * A promise encapsulating a Boolean that indicates {@code true} if the
         * switch happened, or {@code false} otherwise.
         * @memberof Topology#
         * @since 0.4
         */
        switchToCluster: (clusterName: any) => any;
        /**
         * Switch remote cache manager to the default cluster,
         * previously declared via configuration.
         *
         * @return {module:promise.Promise<Boolean>}
         * A promise encapsulating a Boolean that indicates {@code true} if the
         * switch happened, or {@code false} otherwise.
         * @memberof Topology#
         * @since 0.4
         */
        switchToDefaultCluster: () => any;
    };
    /**
     * Get client information represented as a string.
     * @memberof Client#
     * @since 0.4
     */
    toString: () => string;
    registerProtostreamType: (typeName: any, descriptorId: any) => any;
    registerProtostreamRoot: (root: any) => any;
};
export namespace Client {
    namespace config {
        const version: string;
        const cacheName: any;
        const maxRetries: number;
        namespace authentication {
            const enabled: boolean;
            const serverName: string;
            const saslProperties: {};
            const saslMechanism: string;
            const userName: string;
            const password: any[];
            const realm: string;
            const token: string;
        }
        namespace ssl {
            const enabled_1: boolean;
            export { enabled_1 as enabled };
            export const secureProtocol: string;
            export const trustCerts: any[];
            export namespace clientAuth {
                const key: any;
                const passphrase: any;
                const cert: any;
            }
            export const sniHostName: any;
            export namespace cryptoStore {
                export const path: any;
                const passphrase_1: any;
                export { passphrase_1 as passphrase };
            }
        }
        namespace dataFormat {
            const keyType: string;
            const valueType: string;
        }
        const topologyUpdates: boolean;
        const clusters: any[];
    }
}
