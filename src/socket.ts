import dgram from 'react-native-udp';
import { SocketError } from './errors';
import { Buffer } from 'buffer';

class Socket {
    ip: string;
    port: number;
    socket: any;
    private connectPromise: Promise<void> | null;

    /**
     * Represents a UDP socket.
     *
     * @param ip - IP address
     * @param port - port
     */
    constructor(ip: string, port: number) {
        this.ip = ip;
        this.port = port;
        this.socket = dgram.createSocket({ type: 'udp4' });
        this.connectPromise = null;

        // Bind the socket to a local port
        this.socket.bind(0, (err: Error) => {
            if (err) {
                console.error('Error binding socket:', err);
            } else {
                console.log('Socket bound to port:', this.socket.address().port);
            }
        });
    }

    /**
     * Sends data to the socket and returns response wrapped in `Promise`.
     *
     * @remarks
     * Because data is sent using UDP, responses may come in random order
     * and it is required to parse binary response and check if it matches
     * the request.
     *
     * @param data - data to send
     * @param parse - parse function
     * @param match - match function (checks if response matches the request)
     * @param timeout - response timeout
     * @returns `Promise` which will be resolved when matched response comes or
     *    rejected in case of error or timeout
     */
    async send<ResponseType>(
        data: Buffer,
        parse: (msg: Buffer) => ResponseType,
        match: (data: ResponseType) => boolean,
        timeout: number = 5000
    ): Promise<ResponseType> {
        let timer: NodeJS.Timeout | undefined;
        let onMessage: (msg: Buffer, rinfo: any) => void;
        let onError: (err: Error) => void;

        const done = (onFinish: () => void): void => {
            if (timer) {
                clearTimeout(timer);
            }
            this.socket.removeListener('message', onMessage);
            this.socket.removeListener('error', onError);
            onFinish();
        };

        const resultPromise = new Promise<ResponseType>((resolve, reject) => {
            onMessage = (msg: Buffer) => {
                try {
                    const parsed = parse(msg);
                    if (match(parsed)) {
                        done(() => resolve(parsed));
                    }
                } catch (err) {
                    done(() => reject(err));
                }
            };

            onError = (err: Error) => {
                done(() => reject(new SocketError(err.message)));
            };

            if (timeout) {
                timer = setTimeout(() => {
                    done(() => reject(new SocketError('Timeout')));
                }, timeout);
            }

            this.socket.on('message', onMessage);
            this.socket.on('error', onError);

            this.socket.send(data, 0, data.length, this.port, this.ip, (err: Error | null) => {
                if (err) {
                    onError(err);
                }
            });
        });

        return resultPromise;
    }

    /**
     * Closes socket.
     */
    close(): Promise<void> {
        return new Promise<void>((resolve) => {
            try {
                this.socket.close(() => {
                    resolve();
                });
            } catch (err) {
                resolve();
            }
        });
    }
}

export default Socket;
