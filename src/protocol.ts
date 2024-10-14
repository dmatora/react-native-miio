import Packet, { PacketDataRequired } from './packet';
import { ProtocolError } from './errors';
import {hash, encrypt, decrypt, toBuffer} from './crypto';
import { Buffer } from 'buffer';

export type Request<ParamsType = any> = {
    id: number;
    method: string;
    params?: ParamsType | [];
};

export type Response<ResultType = any> =
    | {
          id: number;
          result: ResultType;
      }
    | {
          id: number;
          error: {
              code: number;
              message: string;
          };
      };

class Protocol {
    static HANDSHAKE_PACKET: Packet = new Packet(
        {
            deviceId: 0xffffffff,
            timestamp: 0xffffffff,
            checksum: Buffer.alloc(Packet.CHECKSUM_SIZE, 0xff),
            data: Buffer.alloc(0),
        },
        0xffffffff
    );

    private deviceId: number;
    private key: Buffer;
    private iv: Buffer;
    private token: Buffer;

    /**
     * Represents miIO protocol.
     *
     * @param deviceId - device id
     * @param token - device token
     */
    constructor(deviceId: number, token: Buffer) {
        this.deviceId = deviceId;
        this.token = token;
        this.key = hash(token);
        this.iv = hash(Buffer.concat([this.key, token]));
    }

    /**
     * Checks if  is handshake packet.
     *
     * @param packet -  to check
     * @returns  if packet is handshake packet and  otherwise
     */
    static isHandshake(packet: Packet): boolean {
        return packet.length === Packet.HEADER_SIZE;
    }

    packRequest<ParamsType>(req: Request<ParamsType>, timestamp: number): Packet {
        // Ensure params are handled as buffer-compatible data types
        const payload = {
            ...req,
            params: req.params || [],
        };

        // Convert payload to a buffer before encryption
        const data = toBuffer(JSON.stringify(payload) + '\x00');
        const encryptedData = encrypt(this.key, this.iv, data);

        // Pack the request into a packet
        const fields: PacketDataRequired = {
            deviceId: this.deviceId,
            timestamp: timestamp,
            checksum: this.calcChecksum({
                deviceId: this.deviceId,
                timestamp: timestamp,
                data: encryptedData,
            }),
            data: encryptedData,
        };

        return new Packet(fields);
    }

    /**
     * Extracts device response from .
     *
     * @param packet - response
     * @returns  extracted from the given
     */
    unpackResponse<ResultType>(packet: Packet): Response<ResultType> {
        if (!this.validateChecksum(packet)) {
            throw new ProtocolError("Invalid packet checksum");
        }

        const decrypted = decrypt(this.key, this.iv, packet.data);
        const response = JSON.parse(decrypted.toString());

        return response;
    }

    /**
     * Calculates a checksum for the given .
     *
     * @param fields -  fields required for checksum calculation.
     * @returns checksum for  constructed from
     */
    private calcChecksum(fields: Omit<PacketDataRequired, 'checksum'>): Buffer {
        // Build dummy packet with token in "checksum" field
        // to calculate actual checksum.
        const dummy = new Packet({
            ...fields,
            checksum: this.token,
        });

        return hash(dummy.toBuffer());
    }

    /**
     * Validates checksum of the given .
     *
     * @param packet -  to validate
     * @returns  if checksum is correct and  otherwise
     */
    private validateChecksum(packet: Packet): boolean {
        const { checksum: actual, ...fields } = packet;
        const expected = this.calcChecksum(fields);
        return expected.equals(actual);
    }
}

export default Protocol;
