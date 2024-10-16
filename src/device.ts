import Socket from './socket';
import Protocol, { Request, Response } from './protocol';
import Packet from './packet';
import log from './logger';
import { DeviceError } from './errors';
import { randomInt, randomString, retry } from './utils';
import { Buffer } from 'buffer';

export type DeviceParams = {
    address: string;
    token: string;
    deviceId: number;
    socket?: Socket;
    lastSeenAt?: number;
    timestamp?: number;
};

export type DiscoverParams = {
    address: string;
    token: string;
};

export type CallOptions = {
    attempts?: number;
    delay?: number;
    timeout?: number;
};

class Device {
    static PORT = 54321;
    static MAX_CALL_INTERVAL = 60;
    static DEFAULT_CALL_OPTIONS: Required<CallOptions> = {
        attempts: 3,
        delay: 3000,
        timeout: 3000,
    };

    private protocol: Protocol;
    private socket: Socket;
    private timestamp: number;
    private lastSeenAt: number;
    private handshakePromise: Promise<{ deviceId: number; timestamp: number }> | null;
    private loggerExtension: string;

    id: number;

    /**
     * Represents a miIO `Device`.
     *
     * @param params - device parameters
     * @param params.address - device IP address
     * @param params.token - device token
     * @param params.deviceId - device identifier
     * @param params.socket - socket
     * @param params.lastSeenAt - time of last communication with device
     * @param params.timestamp - last device timestamp
     *
     * @remarks
     * It is recommended not to create device using this constructor but to
     * use `Device.discover` method instead.
     * Parameters `socket`, `lastSeenAt` and `timestamp` are optional and introduced only to
     * be able to avoid double handshake at the start.
     */
    constructor(params: DeviceParams) {
        this.id = params.deviceId;
        this.protocol = new Protocol(params.deviceId, Buffer.from(params.token, 'hex'));
        this.socket = params.socket || new Socket(params.address, Device.PORT);
        this.timestamp = params.timestamp || 0;
        this.lastSeenAt = params.lastSeenAt || 0;
        this.handshakePromise = null;

        this.loggerExtension = params.address;
    }

    /**
     * Helper method for logging with the extension
     */
    private logDebug(message: string, ...args: any[]) {
        log.debug({ extension: this.loggerExtension }, message, ...args);
    }

    /**
     * Makes handshake.
     *
     * @param socket - device socket
     * @param options - call options
     * @returns `Promise` with handshake result
     */
    private static async handshake(
        socket: Socket,
        options: CallOptions
    ): Promise<{ deviceId: number; timestamp: number }> {
        const opts: Required<CallOptions> = { ...Device.DEFAULT_CALL_OPTIONS, ...options };
        const contextId = randomString();

        log.debug({ extension: contextId }, 'Starting handshake');

        let attempt = 0;
        const packet = await retry(
            async () => {
                const requestPacket = Protocol.HANDSHAKE_PACKET;
                log.debug({ extension: contextId }, '-> %O', requestPacket);
                attempt++;
                const requestBuffer = requestPacket.toBuffer();
                log.debug({ extension: contextId }, `#${attempt} ->\n%H`, requestBuffer);
                return await socket.send<Packet>(
                    requestBuffer,
                    (msg) => {
                        log.debug({ extension: contextId }, '<-\n%H', msg);
                        return Packet.fromBuffer(msg);
                    },
                    (packet) => {
                        log.debug({ extension: contextId }, '<- %O', packet);
                        return Protocol.isHandshake(packet);
                    },
                    opts.timeout
                );
            },
            opts.attempts,
            opts.delay
        );
        return {
            deviceId: packet.deviceId,
            timestamp: packet.timestamp,
        };
    }

    /**
     * Connects to device, makes handshake and returns ready to use `Device` instance.
     *
     * @param params - discover parameters
     * @param params.address - device IP address
     * @param params.token - device token
     * @param callOptions - additional options
     * @param callOptions.attempts - handshake attempts
     * @param callOptions.delay - delay between attempts
     * @param callOptions.timeout - handshake response timeout
     * @returns `Device` instance
     */
    static async discover(
        params: DiscoverParams,
        callOptions?: CallOptions
    ): Promise<Device> {
        const options = { ...Device.DEFAULT_CALL_OPTIONS, ...callOptions };
        const socket = new Socket(params.address, Device.PORT);
        let handshakeResult;

        try {
            handshakeResult = await Device.handshake(socket, options);
        } catch (err) {
            await socket.close();
            throw err;
        }

        return new Device({
            deviceId: handshakeResult.deviceId,
            token: params.token,
            address: params.address,
            socket: socket,
            timestamp: handshakeResult.timestamp,
            lastSeenAt: Date.now(),
        });
    }

    /**
     * Makes handshake.
     *
     * @param options - call options
     * @returns `Promise` with handshake result
     *
     * @remarks
     * If called simultaneously, performs handshake only once and returns the same
     * promise for all callers
     */
    private handshake(options: CallOptions): Promise<{
        deviceId: number;
        timestamp: number;
    }> {
        if (!this.handshakePromise) {
            this.handshakePromise = Device.handshake(this.socket, options).finally(
                () => {
                    this.handshakePromise = null;
                }
            );
        }
        return this.handshakePromise;
    }

    /**
     * Returns result of device method call.
     *
     * @param method - device method to call
     * @param params - method parameters
     * @param callOptions - additional options
     * @param callOptions.attempts - call attempts
     * @param callOptions.delay - delay between attempts
     * @param callOptions.timeout - call response timeout
     * @returns result `method` call
     */
    async call<ParamsType extends unknown, ResultType>(
        method: string,
        params?: ParamsType,
        callOptions?: CallOptions
    ): Promise<ResultType> {
        const options: Required<CallOptions> = { ...Device.DEFAULT_CALL_OPTIONS, ...callOptions };
        const contextId = randomString();

        const secondsPassed = Math.floor((Date.now() - this.lastSeenAt) / 1000);

        if (secondsPassed > Device.MAX_CALL_INTERVAL) {
            this.logDebug('-> handshake');
            const { timestamp } = await this.handshake(options);
            this.timestamp = timestamp;
            this.lastSeenAt = Date.now();
        }

        const id = randomInt();
        const body: Request<ParamsType> = { id, method, params: params || [] };
        this.logDebug('-> %O', body);
        const requestPacket = this.protocol.packRequest(body, this.timestamp);
        this.logDebug('-> %O', requestPacket);
        const requestBuffer = requestPacket.toBuffer();
        let attempt = 0;

        const { responsePacket, response } = await retry(
            async () => {
                attempt++;
                this.logDebug(`#${attempt} ->\n%H`, requestBuffer);
                return await this.socket.send<{ responsePacket: Packet; response?: Response<ResultType> }>(
                    requestBuffer,
                    (responseBuffer) => {
                        this.logDebug('<-\n%H', responseBuffer);
                        const responsePacket = Packet.fromBuffer(responseBuffer);
                        this.logDebug('<- %O', responsePacket);
                        const response = !Protocol.isHandshake(responsePacket)
                            ? this.protocol.unpackResponse<ResultType>(responsePacket)
                            : undefined;
                        return { responsePacket, response };
                    },
                    ({ response }) => {
                        this.logDebug('<- %O', response);
                        return response?.id === id;
                    },
                    options.timeout
                );
            },
            options.attempts,
            options.delay
        );

        this.timestamp = responsePacket.timestamp;
        this.lastSeenAt = Date.now();

        if (!response) {
            throw new DeviceError('Empty response');
        }

        if ('error' in response) {
            const err = response.error;
            throw new DeviceError(
                `Device responded with error: "${err.message}". Code: ${err.code}`
            );
        }

        return response.result;
    }

    /**
     * Cleans resources associated with the device.
     */
    async destroy(): Promise<void> {
        await this.socket.close();
    }
}

export default Device;
