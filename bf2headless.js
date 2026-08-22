"use strict";
// BF2 mock client: query, join, CD-key/profile handshake, and keepalive.
const dgram = require("node:dgram");
const dns = require("node:dns").promises;
const crypto = require("node:crypto");
function keyHash(cdKey) {
  const clean = String(cdKey).replace(/-/g, "").toUpperCase();
  return crypto.createHash("md5").update(clean, "latin1").digest("hex");
}
function isKeyHash(value) {
  return /^[0-9a-fA-F]{32}$/.test(String(value));
}
const DEFAULT_GAME_PORT = 16567;
const DEFAULT_QUERY_PORT = 29900;
const DEFAULT_MOD = "mods/bf2";
const JOIN_TIMEOUT_MS = 1000;
const JOIN_RETRIES = 2;
const AUTO_STAGGER_CEILING_MS = 70;
// Online post-join records captured from a real BF2 connection.
const POST_JOIN_TEMPLATE = {
  auth: Buffer.from(
    "1f1004010000005a000a0003086cc4646ac262c4607068c8c4ca66606c6aca68" +
      "c66c7260666ac46a66c27068c2646066646e6ec86cc4c66c6ac470726e60c8ca" +
      "7266cc6a62726e6468ca66c66e70c4cc6072c66e6c00e0dec2c400a2182a8c10" +
      "000098",
    "hex",
  ),
  identity: Buffer.from(
    "1f20080300000041000a0484010000003300000004330c00726b616e746f735b" +
      "46494e5ddc868e41be2c4215000018006e354e74565d51756a4f55464b79466b" +
      "4b33746346705f5f01ca",
    "hex",
  ),
  clientReady: Buffer.from(
    "1f300c0700000010000608a780a9b4803123ff04801040c821",
    "hex",
  ),
  ack1: Buffer.from("171004010000006b0200009a", "hex"),
  ack2: Buffer.from("17200803000000990400009a", "hex"),
  streamAcks: [
    "17300c07000000550600009a",
    "1730100f000000810800009a",
    "1730141f0000003d0a00009a",
    "1730183f000000690c00009a",
    "17301c7f000000250e00009a",
    "173020ff000000511000009a",
    "173024ff0100000d1200009a",
  ].map((hex) => Buffer.from(hex, "hex")),
};
// Ticketless records captured from a LAN/Offline BF2 connection.
const LAN_POST_JOIN_TEMPLATE = {
  sessionStart: Buffer.from("0f100000000000040006000310", "hex"),
  auth: Buffer.from(
    "0f20040100000058000604021b31999ab01831181c1a32b1b219189b9a329a3" +
      "19b1c98991ab19a99301c9a301b331b311a321c1a3132319b9b3233b2313119" +
      "32991b1cb1999b18311a319c18193318999ab1991b00b93337398028860a2304" +
      "0000",
    "hex",
  ),
  identity: Buffer.from(
    "0f300c070000002a000a0884010000001c000000041c0d00726b616e746f735b" +
      "46494e5d31114700000000000000000000011c",
    "hex",
  ),
  clientReady: Buffer.from(
    "0f40100f0000001000060c2700fa00000000ff040000000000",
    "hex",
  ),
  ack1: Buffer.from("07200401000000bd02000096", "hex"),
  ack2: Buffer.from("072008030000007904000096", "hex"),
  streamAcks: [
    "07300c07000000a506000096",
    "0740100f0000006508000096",
    "0740141f0000008d0a000096",
    "0740183f0000004b0c000096",
    "07401c7f000000770e000096",
    "074020ff0000003310000096",
    "074024ff0100005f12000096",
  ].map((hex) => Buffer.from(hex, "hex")),
};
class Logger {
  constructor(opts = {}) {
    this.opts = opts;
  }
  timestamp() {
    return new Date().toISOString();
  }
  log(level, message) {
    const label = this.opts.label ? ` [${this.opts.label}]` : "";
    console.log(`[${this.timestamp()}] [${level}]${label} ${message}`);
  }
  info(message) {
    this.log("INFO", message);
  }
  debug(message) {
    if (this.opts.hex) this.log("DEBUG", message);
  }
  warn(message) {
    this.log("WARN", message);
  }
  error(message) {
    this.log("ERROR", message);
  }
  section(message) {
    const label = this.opts.label ? ` [${this.opts.label}]` : "";
    console.log(`[${this.timestamp()}] [INFO]${label} ==== ${message} ====`);
  }
}
function hex32(value) {
  return "0x" + (value >>> 0).toString(16).padStart(8, "0");
}
function hex8(value) {
  return "0x" + (value & 0xff).toString(16).padStart(2, "0");
}
function dumpHex(label, buffer) {
  console.log(`${label} ${buffer.length} bytes:`);
  const width = 16;
  for (let offset = 0; offset < buffer.length; offset += width) {
    const slice = buffer.subarray(
      offset,
      Math.min(offset + width, buffer.length),
    );
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    console.log(`  ${hex}`);
  }
}
function asciiPreview(buffer) {
  let out = "";
  for (const b of buffer) {
    if (b >= 32 && b <= 126) {
      out += String.fromCharCode(b);
    } else {
      out += ".";
    }
  }
  return out;
}
class BitWriter {
  constructor(initialBytes = 256) {
    this.buffer = Buffer.alloc(initialBytes);
    this.bitPosition = 0;
  }
  ensure(bits) {
    const needed = Math.ceil((this.bitPosition + bits) / 8);
    if (needed <= this.buffer.length) {
      return;
    }
    let size = this.buffer.length;
    while (size < needed) {
      size *= 2;
    }
    const next = Buffer.alloc(size);
    this.buffer.copy(next);
    this.buffer = next;
  }
  writeBits(value, bits) {
    this.ensure(bits);
    value = Number(value) >>> 0;
    for (let i = 0; i < bits; i++) {
      const bit = (value >>> i) & 1;
      const absoluteBit = this.bitPosition + i;
      const byteIndex = absoluteBit >>> 3;
      const bitIndex = absoluteBit & 7;
      if (bit) {
        this.buffer[byteIndex] |= 1 << bitIndex;
      } else {
        this.buffer[byteIndex] &= ~(1 << bitIndex);
      }
    }
    this.bitPosition += bits;
    return this.bitPosition;
  }
  writeByte(value) {
    return this.writeBits(value, 8);
  }
  writeBString(str, length) {
    const data = Buffer.from(str ?? "", "utf8");
    let i = 0;
    for (; i < length; i++) {
      const value = i < data.length ? data[i] : 0;
      this.writeByte(value);
      // Match bf2fp write_bstr(): stop at NUL, then zero-pad.
      if (i >= data.length) {
        continue;
      }
    }
    return this.bitPosition;
  }
  finish() {
    const bytes = Math.ceil(this.bitPosition / 8);
    return {
      buffer: this.buffer.subarray(0, bytes),
      bitLength: this.bitPosition,
    };
  }
}
class BitReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.bitPosition = 0;
  }
  get remainingBits() {
    return this.buffer.length * 8 - this.bitPosition;
  }
  readBits(bits) {
    if (bits < 0 || bits > 32) {
      throw new Error(`Invalid bit count: ${bits}`);
    }
    if (this.remainingBits < bits) {
      throw new Error(
        `Not enough bits: requested ${bits}, ` +
          `only ${this.remainingBits} remain`,
      );
    }
    let value = 0;
    for (let i = 0; i < bits; i++) {
      const absoluteBit = this.bitPosition + i;
      const byteIndex = absoluteBit >>> 3;
      const bitIndex = absoluteBit & 7;
      const bit = (this.buffer[byteIndex] >>> bitIndex) & 1;
      value |= bit << i;
    }
    this.bitPosition += bits;
    return value >>> 0;
  }
  readByte() {
    return this.readBits(8);
  }
  readBString(length) {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = this.readByte();
    }
    const nul = bytes.indexOf(0);
    return bytes.subarray(0, nul >= 0 ? nul : bytes.length).toString("utf8");
  }
}
function setver(gamever) {
  const text = String(gamever);
  // This intentionally stops v3 at "-", reproducing sscanf("%d").
  const match = text.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)(?:\.([0-9]+))?/);
  if (!match) {
    throw new Error(`Could not parse BF2 game version: ${text}`);
  }
  const v1 = Number(match[1]);
  const v2 = Number(match[2]);
  const v3 = Number(match[3]);
  const v4 = match[4] !== undefined ? Number(match[4]) : 0;
  return (
    (((v1 & 0x0f) << 28) |
      ((v2 & 0x0f) << 24) |
      ((v3 & 0xffff) << 8) |
      (v4 & 0xff)) >>>
    0
  );
}
const GS2_QUERY = Buffer.from([
  0xfe, 0xfd, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0xff, 0x00, 0x00,
  0x00,
]);
async function resolveIPv4(host) {
  const result = await dns.lookup(host, {
    family: 4,
  });
  return result.address;
}
function parseGameSpyInfo(buffer) {
  // BF2/GS2 info pairs begin after a five-byte prefix.
  const fields = {};
  let start = 5;
  while (start < buffer.length) {
    const keyEnd = buffer.indexOf(0, start);
    if (keyEnd < 0) {
      break;
    }
    const key = buffer.subarray(start, keyEnd).toString("latin1");
    start = keyEnd + 1;
    if (!key) {
      break;
    }
    const valueEnd = buffer.indexOf(0, start);
    if (valueEnd < 0) {
      break;
    }
    const value = buffer.subarray(start, valueEnd).toString("latin1");
    start = valueEnd + 1;
    fields[key] = value;
  }
  return fields;
}
async function queryGameServer(ip, queryPort, gamePort, logger, showHex) {
  logger.section("GameSpy / server version query");
  logger.info(`Resolved target -> ${ip}`);
  logger.info(
    `Query order: UDP ${ip}:${queryPort}, ` + `then UDP ${ip}:${gamePort}`,
  );
  const socket = dgram.createSocket("udp4");
  try {
    const localPort = await bindSocket(socket, 0);
    logger.info(`Query socket bound to ` + `0.0.0.0:${localPort}`);
    const ports = [queryPort, gamePort];
    for (const port of ports) {
      logger.debug(`Sending GS2 query to ` + `${ip}:${port}`);
      if (showHex) {
        dumpHex(`[GS2 TX -> ${ip}:${port}]`, GS2_QUERY);
      }
      try {
        const reply = await sendAndReceive(socket, GS2_QUERY, ip, port, 1000);
        logger.info(`[GS2 RX <- ${ip}:${port}] ` + `${reply.msg.length} bytes`);
        if (showHex) {
          dumpHex("[GS2 RX]", reply.msg);
        }
        logger.info(`ASCII preview: ` + `${asciiPreview(reply.msg)}`);
        const fields = parseGameSpyInfo(reply.msg);
        for (const [key, value] of Object.entries(fields)) {
          if (
            [
              "hostname",
              "gamever",
              "mapname",
              "numplayers",
              "maxplayers",
              "gamemode",
              "hostport",
            ].includes(key)
          ) {
            logger.info(`GS field ${key} = ${value}`);
          }
        }
        return {
          fields,
          sourcePort: reply.rinfo.port,
        };
      } catch (err) {
        logger.debug(`No GS2 response from ` + `${ip}:${port}: ${err.message}`);
      }
    }
    throw new Error("No GameSpy server query response received");
  } finally {
    try {
      socket.close();
    } catch (_) {
      // already closed
    }
  }
}
function buildJoinPacket({ version, password, mod, par1 = 1, par2 = 0x1002 }) {
  const writer = new BitWriter();
  writer.writeBits(1, 4);
  writer.writeBits(par1, 8);
  writer.writeBits(par2, 32);
  writer.writeBits(version, 32);
  writer.writeBits(1, 1);
  writer.writeBits(0, 32);
  writer.writeBString(password, 32);
  writer.writeBString(mod, 32);
  return writer.finish();
}
function classifyResult(result) {
  if (result === 2) {
    return "JOIN/PLAYER ACCEPTED";
  }
  if (result === 3) {
    return "REJECT / error path";
  }
  if (result === 0) {
    return "ZERO / special path";
  }
  return "UNKNOWN";
}
function errorMeaning(error) {
  switch (error >>> 0) {
    case 0x00000002:
      return "server full";
    case 0x00000011:
      return "server is password protected";
    case 0x00000017:
      return "client version is older than server";
    case 0x00000018:
      return "client version is newer than server";
    case 0x00000024:
      return "server requested/mod negotiation";
    default:
      return "unknown BF2 error/status code";
  }
}
function parseJoinReply(buffer) {
  const reader = new BitReader(buffer);
  const result = reader.readBits(4);
  // bf2fp skips an eight-bit field between result and error.
  const skipped = reader.readBits(8);
  const error = reader.readBits(32);
  return {
    result,
    skipped,
    error,
    consumedBits: reader.bitPosition,
    remainingBits: reader.remainingBits,
  };
}
function bindSocket(socket, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      socket.removeListener("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      socket.removeListener("error", onError);
      const address = socket.address();
      resolve(typeof address === "object" ? address.port : port);
    };
    socket.once("error", onError);
    socket.once("listening", onListening);
    socket.bind(port, "0.0.0.0");
  });
}
function waitForUdp(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      finish(reject, new Error("UDP receive timeout"));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      socket.removeListener("message", onMessage);
      socket.removeListener("error", onError);
      socket.removeListener("close", onClose);
    }
    function finish(fn, value) {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      fn(value);
    }
    function onMessage(msg, rinfo) {
      finish(resolve, {
        msg,
        rinfo,
      });
    }
    function onError(err) {
      finish(reject, err);
    }
    function onClose() {
      finish(reject, new Error("UDP socket closed"));
    }
    socket.once("message", onMessage);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}
async function sendAndReceive(socket, packet, ip, port, timeoutMs) {
  await new Promise((resolve, reject) => {
    socket.send(packet, 0, packet.length, port, ip, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
  return await waitForUdp(socket, timeoutMs);
}
function readAlignedBytes(buffer, bitOffset) {
  const output = [];
  for (let bit = bitOffset; bit + 8 <= buffer.length * 8; bit += 8) {
    let value = 0;
    for (let index = 0; index < 8; index++) {
      value |=
        ((buffer[(bit + index) >> 3] >> ((bit + index) & 7)) & 1) << index;
    }
    output.push(value);
  }
  return Buffer.from(output);
}
function decodeServerCdKeyChallenge(packet) {
  if (packet.length < 13 || (packet[0] & 0x0f) !== 0x0f) {
    throw new Error(
      `Not a BF2 CD-key challenge packet: ` + `${packet.toString("hex")}`,
    );
  }
  // The logical challenge record starts seven bits into byte nine.
  const decoded = readAlignedBytes(packet.subarray(9), 7);
  if (decoded[0] !== 0 || decoded[1] !== 2) {
    throw new Error(
      `Unexpected CD-key challenge record: ` + `${decoded.toString("hex")}`,
    );
  }
  const terminator = decoded.indexOf(0, 2);
  if (terminator < 0) {
    throw new Error("CD-key challenge has no NUL terminator");
  }
  return decoded.subarray(2, terminator).toString("ascii");
}
function gamespyCdKeyResponse(
  cdKey,
  challenge,
  randomValue = (crypto.randomBytes(2).readUInt16LE(0) & 0x7fff) * 0x10000 +
    (crypto.randomBytes(2).readUInt16LE(0) & 0x7fff),
) {
  const normalized = String(cdKey).replace(/-/g, "").toUpperCase();
  const md5 = (value) =>
    crypto.createHash("md5").update(value, "latin1").digest("hex");
  const nonce = randomValue.toString(16).padStart(8, "0");
  // GameSpy gcd_compute_response, CDResponseMethod_NEWAUTH.
  const proof = md5(normalized + String(randomValue % 0xffff) + challenge);
  return md5(normalized) + nonce + proof;
}
function writeByteAtBitOffset(buffer, bitOffset, value) {
  for (let index = 0; index < 8; index++) {
    const absolute = bitOffset + index;
    const mask = 1 << (absolute & 7);
    if ((value >> index) & 1) {
      buffer[absolute >> 3] |= mask;
    } else {
      buffer[absolute >> 3] &= ~mask;
    }
  }
}
function buildCdKeyAuthPacket(cdKey, serverPacket, lanMode = false) {
  const challenge = decodeServerCdKeyChallenge(serverPacket);
  const response = gamespyCdKeyResponse(cdKey, challenge);
  const packet = Buffer.from(
    lanMode ? LAN_POST_JOIN_TEMPLATE.auth : POST_JOIN_TEMPLATE.auth,
  );
  if (response.length !== 72) {
    throw new Error("GameSpy CD-key response must be 72 bytes");
  }
  // Mutate only the dynamic proof in the captured Refractor frame.
  const responseBit = lanMode ? 9 * 8 + 7 + 2 * 8 : 9 * 8 + 1 + 4 * 8;
  const bytes = Buffer.from(response, "ascii");
  for (let index = 0; index < bytes.length; index++) {
    writeByteAtBitOffset(packet, responseBit + index * 8, bytes[index]);
  }
  // BF2 repeats the first four challenge bytes after the proof.
  const challengePrefix = Buffer.from(challenge.slice(0, 4), "ascii");
  if (challengePrefix.length !== 4) {
    throw new Error(
      `CD-key challenge is shorter than four bytes: ${challenge}`,
    );
  }
  const challengeBit = responseBit + response.length * 8 + 8;
  for (let index = 0; index < challengePrefix.length; index++) {
    writeByteAtBitOffset(
      packet,
      challengeBit + index * 8,
      challengePrefix[index],
    );
  }
  return {
    packet,
    challenge,
    response,
  };
}
function buildPlayerIdentityPacket(
  playerName,
  offlineProfile = false,
  profileId = 0,
  lanMode = false,
) {
  const template = lanMode
    ? LAN_POST_JOIN_TEMPLATE.identity
    : POST_JOIN_TEMPLATE.identity;
  const capturedName = Buffer.from(
    lanMode ? "rkantos[FIN]1" : "rkantos[FIN]",
    "ascii",
  );
  const replacement = Buffer.from(playerName, "ascii");
  if (
    replacement.length < 1 ||
    replacement.length > 30 ||
    replacement.toString("ascii") !== playerName
  ) {
    throw new Error("Player name must be 1-30 ASCII bytes");
  }
  const offset = template.indexOf(capturedName);
  if (offset < 0) {
    throw new Error("Captured identity name marker was not found");
  }
  let packet = Buffer.concat([
    template.subarray(0, offset),
    replacement,
    template.subarray(offset + capturedName.length),
  ]);
  const delta = replacement.length - capturedName.length;
  // Outer payload, nested payload, duplicate nested length, name.
  const capturedPayloadLength = lanMode ? 0x2a : 0x41;
  const capturedIdentityLength = lanMode ? 0x1c : 0x33;
  packet.writeUInt16LE(capturedPayloadLength + delta, 7);
  packet.writeUInt32LE(capturedIdentityLength + delta, 16);
  packet[21] = capturedIdentityLength + delta;
  packet.writeUInt16LE(replacement.length, 22);
  if (lanMode) {
    // The LAN profile field follows the player name and uses zigzag encoding.
    const accountOffset = offset + replacement.length;
    packet.writeUInt32LE((profileId * 2) >>> 0, accountOffset + 4);
  } else if (offlineProfile) {
    const ticket = Buffer.from("n5NtV]QujOUFKyFkK3tcFp__", "ascii");
    const ticketOffset = packet.indexOf(ticket);
    if (ticketOffset < 12) {
      throw new Error("Captured profile ticket marker was not found");
    }
    // Clear account data, set the local profile ID, and remove the ticket.
    packet.fill(0, ticketOffset - 12, ticketOffset);
    packet.writeUInt32LE((profileId * 2) >>> 0, ticketOffset - 8);
    packet = Buffer.concat([
      packet.subarray(0, ticketOffset),
      packet.subarray(ticketOffset + ticket.length),
    ]);
    packet.writeUInt16LE(0x41 + delta - ticket.length, 7);
    packet.writeUInt32LE(0x33 + delta - ticket.length, 16);
    packet[21] = 0x33 + delta - ticket.length;
  }
  return packet;
}
function buildPostJoinKeepaliveReply(packet, lanMode = false) {
  if (packet.length !== 12 || (packet[0] & 0x0f) !== 7) {
    throw new Error(
      `Unexpected BF2 keepalive packet: ` + `${packet.toString("hex")}`,
    );
  }
  return Buffer.concat([
    Buffer.from([lanMode ? 0x08 : 0x18]),
    packet.subarray(1, 11),
    Buffer.from(lanMode ? "9600000000" : "9a00000046", "hex"),
  ]);
}
function buildPostJoinAcceptAck(successToken) {
  // LSB-first fields: type (4), acknowledgement sequence (8), state (4).
  const sequence = successToken & 0xff;
  return Buffer.from([
    0x04 | ((sequence & 0x0f) << 4),
    ((sequence >>> 4) & 0x0f) | 0x20,
  ]);
}
async function sendPostJoinPacket(
  socket,
  packet,
  resolved,
  opts,
  logger,
  label,
) {
  let outgoing = packet;
  // Rewrite the captured frame's split eight-bit connection-stream field.
  if (label !== "accept-ack" && Number.isInteger(opts.postJoinStream)) {
    outgoing = Buffer.from(packet);
    outgoing[0] = (outgoing[0] & 0x0f) | ((opts.postJoinStream & 0x0f) << 4);
    outgoing[1] = (outgoing[1] & 0xf0) | ((opts.postJoinStream >>> 4) & 0x0f);
  }
  await new Promise((resolve, reject) => {
    socket.send(outgoing, 0, outgoing.length, opts.port, resolved.ip, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  logger.info(`[POSTJOIN TX] ${label}: ` + `${outgoing.length} bytes`);
  if (logger.opts.hex) {
    dumpHex(`[POSTJOIN TX ${label}]`, outgoing);
  }
}
async function maintainConnection(socket, logger, opts, resolved, joinReply) {
  const active = Boolean(opts.name && opts.cdkey);
  const postJoinTemplate = opts.lanMode
    ? LAN_POST_JOIN_TEMPLATE
    : POST_JOIN_TEMPLATE;
  const send = (packet, label) =>
    sendPostJoinPacket(socket, packet, resolved, opts, logger, label);
  let serverData = 0;
  let waitingForServerAck = 0;
  let streamAckIndex = 0;
  let sessionStarted = false;
  let clientReadySent = false;
  logger.section("Maintaining fake-player connection");
  logger.info("Join was accepted; keeping the UDP socket open.");
  if (active) {
    opts.postJoinStream = joinReply.error & 0xff;
    const acceptAck = buildPostJoinAcceptAck(joinReply.error);
    logger.info(
      `ACTIVE MODE: authenticating as ` +
        `${JSON.stringify(opts.name)} with CD-key hash ` +
        `${opts.keyhash}.`,
    );
    logger.info(
      `Accepted-join token=${hex32(joinReply.error)}, ` +
        `stream=${opts.postJoinStream}, ` +
        `ACK=${acceptAck.toString("hex")}`,
    );
    await send(acceptAck, "accept-ack");
  } else {
    logger.warn(
      "PASSIVE MODE: supply both --name and --cdkey to create " +
        "a player visible in admin.listPlayers.",
    );
  }
  logger.info("Press Ctrl+C to terminate.");
  while (true) {
    try {
      const { msg, rinfo } = await waitForUdp(socket, 5000);
      logger.info(
        `[SERVER RX] ${msg.length} bytes ` +
          `from ${rinfo.address}:${rinfo.port}`,
      );
      if (logger.opts.hex) {
        dumpHex("[SERVER RX HEX]", msg);
      }
      logger.debug(`[SERVER RX ASCII] ${asciiPreview(msg)}`);
      if (!active) {
        logger.debug("[POSTJOIN] Passive mode; no response sent.");
        continue;
      }
      const type = msg[0] & 0x0f;
      if (type === 7 && msg.length === 12) {
        await send(
          buildPostJoinKeepaliveReply(msg, opts.lanMode),
          "keepalive",
        );
        if (opts.lanMode && !sessionStarted) {
          await send(LAN_POST_JOIN_TEMPLATE.sessionStart, "offline-session-start");
          sessionStarted = true;
        }
        continue;
      }
      if (type === 15) {
        serverData++;
        if (serverData === 1) {
          const auth = buildCdKeyAuthPacket(opts.cdkey, msg, opts.lanMode);
          logger.info(`[POSTJOIN] CD-key challenge: ` + `${auth.challenge}`);
          logger.info(
            `[POSTJOIN] GameSpy nonce: ` + `${auth.response.slice(32, 40)}`,
          );
          await send(auth.packet, "cdkey-auth");
        } else if (serverData === 2) {
          await send(postJoinTemplate.ack1, "stream-ack-1");
          waitingForServerAck = 1;
        } else if (serverData === 3) {
          await send(postJoinTemplate.ack2, "stream-ack-2");
          waitingForServerAck = 2;
        } else if (streamAckIndex < postJoinTemplate.streamAcks.length) {
          const sendOfflineReady =
            opts.lanMode && streamAckIndex === 0 && !clientReadySent;
          await send(
            postJoinTemplate.streamAcks[streamAckIndex],
            `stream-ack-${streamAckIndex + 3}`,
          );
          streamAckIndex++;
          if (sendOfflineReady) {
            await send(LAN_POST_JOIN_TEMPLATE.clientReady, "client-ready");
            clientReadySent = true;
          }
          if (streamAckIndex === postJoinTemplate.streamAcks.length) {
            logger.info(
              "*** Initial BF2 player handshake completed; " +
                "the player should now be visible in " +
                "admin.listPlayers / bf2cc pl. ***",
            );
          }
        } else {
          logger.debug(
            "[POSTJOIN] Additional server reliable record " +
              "received; keepalive state will retain the player.",
          );
        }
        continue;
      }
      if (type === 8 && waitingForServerAck === 1) {
        waitingForServerAck = 0;
        if (!opts.lanMode) {
          await send(
            buildPlayerIdentityPacket(
              opts.name,
              opts.offlineProfile,
              opts.profileId,
              false,
            ),
            "player-identity",
          );
        }
        continue;
      }
      if (type === 8 && waitingForServerAck === 2) {
        waitingForServerAck = 0;
        await send(
          opts.lanMode
            ? buildPlayerIdentityPacket(opts.name, true, opts.profileId, true)
            : postJoinTemplate.clientReady,
          opts.lanMode ? "player-identity" : "client-ready",
        );
        if (!opts.lanMode) {
          clientReadySent = true;
        }
        continue;
      }
      if (type === 5) {
        logger.warn("Server sent a BF2 disconnect record.");
        return;
      }
      logger.debug(`[POSTJOIN] No handler for packet type ${type}.`);
    } catch (err) {
      // Silence is normal; keep the accepted socket alive.
      if (err && err.message === "UDP receive timeout") {
        logger.debug(
          "No server packet received during the last " +
            "5 seconds; socket remains open.",
        );
        continue;
      }
      logger.error(`Persistent connection error: ` + `${err.message}`);
      throw err;
    }
  }
}
async function doJoin(opts, resolved, attemptNo, logger) {
  const socket = dgram.createSocket("udp4");
  let localPort;
  try {
    localPort = await bindSocket(socket, opts.bindPort);
    logger.section(`Join attempt #${attemptNo}`);
    logger.info(`Local UDP endpoint: ` + `0.0.0.0:${localPort}`);
    logger.info(`Target UDP endpoint: ` + `${resolved.ip}:${opts.port}`);
    logger.info(
      `Version: ${resolved.gamever} ` + `(${hex32(resolved.version)})`,
    );
    // Match bf2fp's alternate protocol-build fallback after no reply.
    const parConfigs = [
      { par1: 1, par2: 0x1002 },
      { par1: 0x10, par2: 0xf005 },
    ];
    let reply = null;
    let lastError = null;
    for (let cfgIndex = 0; cfgIndex < parConfigs.length; cfgIndex++) {
      const { par1, par2 } = parConfigs[cfgIndex];
      logger.info(
        `par1=${hex8(par1)} par2=${hex32(par2)} ` +
          `password=${JSON.stringify(opts.password)} ` +
          `mod=${JSON.stringify(opts.mod)}`,
      );
      const {
        buffer: packet,
        bitLength,
      } = buildJoinPacket({
        version: resolved.version,
        password: opts.password,
        mod: opts.mod,
        par1,
        par2,
      });
      logger.debug(
        `Join packet logical length = ` +
          `${bitLength} bits, padded to ` +
          `${packet.length} bytes`,
      );
      if (opts.hex) {
        dumpHex("[JOIN TX]", packet);
      }
      for (let retry = 1; retry <= JOIN_RETRIES; retry++) {
        try {
          logger.debug(
            `Sending join packet ` + `(retry ${retry}/${JOIN_RETRIES})...`,
          );
          reply = await sendAndReceive(
            socket,
            packet,
            resolved.ip,
            opts.port,
            opts.timeout,
          );
          break;
        } catch (err) {
          lastError = err;
          logger.warn(`Join retry ${retry} failed: ` + `${err.message}`);
        }
      }
      if (reply) {
        break;
      }
      if (cfgIndex + 1 < parConfigs.length) {
        const nextCfg = parConfigs[cfgIndex + 1];
        logger.warn(
          `No reply with par1=${hex8(par1)}/par2=${hex32(par2)}; ` +
            `falling back to par1=${hex8(nextCfg.par1)}/` +
            `par2=${hex32(nextCfg.par2)} (bf2fp behavior).`,
        );
      }
    }
    if (!reply) {
      logger.error(
        `No join reply from server: ` +
          `${lastError?.message ?? "unknown error"}`,
      );
      return {
        accepted: false,
        replied: false,
        localPort,
      };
    }
    logger.info(
      `RX from ${reply.rinfo.address}:` +
        `${reply.rinfo.port} ` +
        `(${reply.msg.length} bytes)`,
    );
    logger.debug(`Join reply hex: ` + `${reply.msg.toString("hex")}`);
    if (opts.hex) {
      dumpHex("[JOIN RX]", reply.msg);
    }
    logger.debug(`RX ASCII preview: ` + `${asciiPreview(reply.msg)}`);
    let parsed;
    try {
      parsed = parseJoinReply(reply.msg);
    } catch (err) {
      logger.error(`Could not parse join reply: ` + `${err.message}`);
      return {
        accepted: false,
        replied: true,
        localPort,
      };
    }
    logger.info(
      `Parsed join reply: ` +
        `result=${parsed.result} ` +
        `(${classifyResult(parsed.result)}), ` +
        `error=${hex32(parsed.error)} ` +
        `(${errorMeaning(parsed.error)})`,
    );
    logger.debug(
      `Reply consumed ${parsed.consumedBits} bits; ` +
        `${parsed.remainingBits} bits remain`,
    );
    if (parsed.result === 2) {
      logger.info("*** Server accepted the fake-player join ***");
      if (typeof opts.onJoinAccepted === "function") {
        opts.onJoinAccepted();
      }
      logger.info(
        `Fake player is associated with local UDP ` + `port ${localPort}`,
      );
      try {
        await maintainConnection(socket, logger, opts, resolved, parsed);
      } finally {
        logger.info("Persistent fake-player connection ending.");
      }
      return {
        accepted: true,
        replied: true,
        localPort,
        parsed,
      };
    }
    if (parsed.error === 0x02) {
      logger.warn("Server reports that it is full.");
      return {
        accepted: false,
        replied: true,
        localPort,
        parsed,
      };
    }
    if (parsed.error === 0x11) {
      logger.warn("Server reports that a password is required.");
      return {
        accepted: false,
        replied: true,
        localPort,
        parsed,
      };
    }
    if (parsed.error === 0x17) {
      logger.error(
        "Server rejected the client because its version " +
          "is older than the server.",
      );
    }
    if (parsed.error === 0x18) {
      logger.error(
        "Server rejected the client because its version " +
          "is newer than the server.",
      );
    }
    if (parsed.error === 0x24) {
      logger.warn("Server requested mod negotiation.");
      try {
        const reader = new BitReader(reply.msg);
        reader.readBits(4);
        reader.readBits(8);
        reader.readBits(32);
        // Match bf2fp's unusual b+1 offset before the mod string.
        if (reader.remainingBits >= 1) {
          reader.readBits(1);
        }
        const serverMod = reader.readBString(32);
        logger.info(
          `Server supplied mod string: ` + `${JSON.stringify(serverMod)}`,
        );
      } catch (err) {
        logger.warn(`Could not decode requested mod: ` + `${err.message}`);
      }
    }
    logger.warn("Server did not accept the fake-player join.");
    return {
      accepted: false,
      replied: true,
      localPort,
      parsed,
    };
  } finally {
    if (socket && !socket.destroyed) {
      try {
        socket.close();
      } catch (_) {
        // socket may already have been closed
      }
    }
  }
}
function parseArgs(argv) {
  const opts = {
    host: null,
    port: DEFAULT_GAME_PORT,
    queryPort: DEFAULT_QUERY_PORT,
    password: "",
    mod: DEFAULT_MOD,
    gamever: null,
    name: "",
    cdkey: null,
    keyhash: null,
    offlineProfile: false,
    lanMode: false,
    profileId: 0,
    hex: false,
    bindPort: 0,
    timeout: JOIN_TIMEOUT_MS,
    attempts: 1,
    staggerMs: null,
    noQuery: false,
    duration: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--password":
      case "-P":
        opts.password = argv[++i] ?? "";
        break;
      case "--port":
      case "-p":
        opts.port = Number(argv[++i]);
        break;
      case "--query-port":
        opts.queryPort = Number(argv[++i]);
        break;
      case "--mod":
        opts.mod = argv[++i] ?? DEFAULT_MOD;
        break;
      case "--gamever":
      case "-v":
        opts.gamever = argv[++i] ?? null;
        break;
      case "--name":
      case "-n":
        opts.name = argv[++i] ?? "";
        break;
      case "--cdkey":
        opts.cdkey = argv[++i] ?? null;
        break;
      case "--keyhash":
        opts.keyhash = argv[++i] ?? null;
        break;
      case "--offline-profile":
        opts.offlineProfile = true;
        break;
      case "--lan-mode":
        opts.offlineProfile = true;
        opts.lanMode = true;
        break;
      case "--profile-id":
        opts.profileId = Number(argv[++i]);
        break;
      case "--hex":
        opts.hex = true;
        break;
      case "--bind-port":
        opts.bindPort = Number(argv[++i]);
        break;
      case "--timeout":
        opts.timeout = Number(argv[++i]);
        break;
      case "--attempts":
      case "--count":
        opts.attempts = Number(argv[++i]);
        break;
      case "--stagger":
        {
          const value = argv[++i];
          opts.staggerMs = value === "auto" ? null : Number(value);
        }
        break;
      case "--no-query":
        opts.noQuery = true;
        break;
      case "--duration":
        opts.duration = Number(argv[++i]);
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        if (!opts.host) {
          opts.host = arg;
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
    }
  }
  if (!opts.host) {
    throw new Error("No BF2 server hostname supplied");
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error(`Invalid game port: ${opts.port}`);
  }
  if (
    !Number.isInteger(opts.queryPort) ||
    opts.queryPort < 1 ||
    opts.queryPort > 65535
  ) {
    throw new Error(`Invalid query port: ${opts.queryPort}`);
  }
  if (
    !Number.isInteger(opts.bindPort) ||
    opts.bindPort < 0 ||
    opts.bindPort > 65535
  ) {
    throw new Error(`Invalid bind port: ${opts.bindPort}`);
  }
  if (!Number.isFinite(opts.timeout) || opts.timeout < 100) {
    throw new Error(`Invalid timeout: ${opts.timeout}`);
  }
  if (!Number.isInteger(opts.attempts) || opts.attempts < 1) {
    throw new Error(`Invalid attempts: ${opts.attempts}`);
  }
  if (opts.cdkey) {
    const derived = keyHash(opts.cdkey);
    if (opts.keyhash && opts.keyhash.toLowerCase() !== derived) {
      throw new Error(
        `--keyhash (${opts.keyhash}) does not match ` +
          `the hash of --cdkey (${derived})`,
      );
    }
    opts.keyhash = derived;
  } else if (opts.keyhash) {
    if (!isKeyHash(opts.keyhash)) {
      throw new Error(
        `--keyhash must be 32 hex characters, got: ` + `${opts.keyhash}`,
      );
    }
    opts.keyhash = opts.keyhash.toLowerCase();
  }
  if (
    opts.staggerMs !== null &&
    (!Number.isFinite(opts.staggerMs) || opts.staggerMs < 0)
  ) {
    throw new Error(`Invalid stagger delay: ${opts.staggerMs}`);
  }
  if (opts.attempts > 1 && opts.bindPort !== 0) {
    throw new Error("--bind-port must be 0 when --count is greater than 1");
  }
  if (
    !Number.isInteger(opts.profileId) ||
    opts.profileId < 0 ||
    opts.profileId > 0x7fffffff ||
    opts.profileId > 0x7fffffff - (opts.attempts - 1)
  ) {
    throw new Error(
      `Invalid profile ID range: ${opts.profileId} through ` +
        `${opts.profileId + opts.attempts - 1}`,
    );
  }
  if (opts.profileId !== 0 && !opts.offlineProfile) {
    throw new Error("--profile-id requires --offline-profile");
  }
  if (opts.name || opts.cdkey || opts.keyhash) {
    if (!opts.name) {
      throw new Error("--cdkey/--keyhash requires --name");
    }
    const nameBytes = Buffer.from(opts.name, "ascii");
    if (
      nameBytes.length < 1 ||
      nameBytes.length > 30 ||
      nameBytes.toString("ascii") !== opts.name
    ) {
      throw new Error("--name must contain 1-30 ASCII bytes");
    }
    if (!opts.cdkey) {
      throw new Error(
        "--name requires the raw --cdkey; --keyhash alone " +
          "cannot produce the per-session GameSpy proof",
      );
    }
  }
  return opts;
}
function printUsage() {
  console.log(`
BF2 headless fake-player client
Usage:
  node bf2headless.js --hex skascz.bf2.top
Options:
  --password, -P VALUE
      BF2 server password.
  --port, -p PORT
      BF2 game port.
      Default: ${DEFAULT_GAME_PORT}
  --query-port PORT
      GameSpy query port.
      Default: ${DEFAULT_QUERY_PORT}
  --mod VALUE
      BF2 mod string.
      Default: ${DEFAULT_MOD}
  --name, -n VALUE
      Player name to expose through admin.listPlayers / bf2cc pl.
      Must be 1-30 ASCII bytes and used with --cdkey.
  --cdkey VALUE
      Raw BF2 CD key (XXXX-XXXX-XXXX-XXXX-XXXX). It is MD5-hashed
      (dashes stripped, upper-cased) into the key hash and used to
      answer the server's per-session GameSpy challenge. The raw
      key itself is never sent on the wire.
  --keyhash VALUE
      Optional 32-char hash used to verify --cdkey. It cannot replace
      --cdkey because the challenge proof requires the raw key.
  --offline-profile
      Omit the captured GameSpy profile ID and login ticket while using
      the proven online transport framing. The profile ID is 0 unless
      --profile-id is set.
  --lan-mode
      Use the exact packet ordering captured from a real ticketless
      LAN/Offline BF2 account. This implies --offline-profile.
  --profile-id NUMBER
      Base local profile identifier for ticketless clients. With --count,
      a nonzero base increments for each mock; zero remains zero for all.
      Requires --offline-profile.
      Use values above 1000000 to avoid normal BF2Hub profile IDs.
  --hex
      Print hexadecimal packet dumps.
  --bind-port PORT
      Local UDP source port.
      Default: 0 (OS chooses one)
  --timeout MS
      Join reply timeout.
      Default: ${JOIN_TIMEOUT_MS}
  --count N, --attempts N
      Number of mock clients. Names are suffixed 1..N and each client
      receives a distinct derived CD-key hash. Default: 1.
  --stagger MS|auto
      Delay between starting mock-client handshakes. In auto mode, the
      next client starts as soon as the server accepts the previous one,
      with a ${AUTO_STAGGER_CEILING_MS} ms fallback. Default: auto.
  --gamever, -v VALUE
      Exact server version, e.g. 1.5.3153.0. Required with
      --no-query; otherwise it is read from the GameSpy query.
  --no-query
      Skip the GameSpy query and use --gamever instead.
  --duration SECONDS
      Exit automatically after SECONDS (join + post-join capture),
      instead of holding the connection open forever. Handy for a
      bounded, authorized packet capture.
Examples:
  node bf2headless.js --name GatherMock --cdkey C0DE-BEEF-1234-5678-9ABC \\
      --offline-profile --profile-id 1000001 --count 8 skascz.bf2.top
  node bf2headless.js --name OfflineTest --cdkey AAAA-BBBB-CCCC-DDDD-EEEE \\
      --lan-mode --profile-id 1100001 skascz.bf2.top
  node bf2headless.js --hex --port 16567 skascz.bf2.top
`);
}
async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Argument error: ${err.message}`);
    printUsage();
    process.exit(1);
  }
  const logger = new Logger({
    hex: opts.hex,
  });
  if (Number.isFinite(opts.duration) && opts.duration > 0) {
    setTimeout(() => {
      console.log(
        `[${new Date().toISOString()}] [INFO] ` +
          `Capture duration (${opts.duration}s) elapsed; exiting.`,
      );
      process.exit(0);
    }, opts.duration * 1000);
  }
  logger.section("Configuration");
  logger.info(`Target: ${opts.host}:${opts.port}`);
  logger.info(
    `Password supplied: ` + `${opts.password.length > 0 ? "yes" : "no"}`,
  );
  logger.info(
    `Player name: ` + `${opts.name ? JSON.stringify(opts.name) : "(none)"}`,
  );
  if (opts.keyhash) {
    logger.info(
      `CD-key hash: ${opts.keyhash}` +
        `${opts.cdkey ? " (derived from --cdkey)" : ""}`,
    );
  } else {
    logger.info("CD-key hash: (none supplied)");
  }
  logger.info(`Requested attempts: ${opts.attempts}`);
  logger.info("Bitstream implementation: " + "LSB-first, matching rwbits.c");
  logger.debug(
    "The original bf2fp implementation does not send " +
      "a CD-key hash in its join packet. This client reproduces " +
      "that join, then performs the captured CD-key challenge and " +
      "player-identity exchange after acceptance.",
  );
  let ip;
  try {
    ip = await resolveIPv4(opts.host);
    logger.info(`Resolved ${opts.host} -> ${ip}`);
  } catch (err) {
    logger.error(`DNS resolution failed: ${err.message}`);
    process.exit(1);
  }
  let queryFields = {};
  if (!opts.noQuery) {
    try {
      const result = await queryGameServer(
        ip,
        opts.queryPort,
        opts.port,
        logger,
        opts.hex,
      );
      queryFields = result.fields;
    } catch (err) {
      logger.error(`GameSpy query failed: ${err.message}`);
      process.exit(1);
    }
  }
  const gamever = opts.noQuery ? opts.gamever : queryFields.gamever;
  if (!gamever) {
    if (opts.noQuery) {
      logger.error("--no-query was given but no --gamever was supplied.");
      logger.error(
        "Pass e.g. --gamever 1.5.3153.0 so the version can " +
          "be encoded without querying the server.",
      );
    } else {
      logger.error("No gamever was returned by the server.");
      logger.error(
        "Use --no-query together with --gamever to skip " +
          "the GameSpy query.",
      );
    }
    process.exit(1);
  }
  let version;
  try {
    version = setver(gamever);
  } catch (err) {
    logger.error(`Could not encode game version: ${err.message}`);
    process.exit(1);
  }
  logger.info(
    `GameSpy reported hostport=` + `${queryFields.hostport ?? opts.port}`,
  );
  logger.info(`Using game version ${gamever} => ` + `${hex32(version)}`);
  logger.section("Joining");
  const resolved = {
    ip,
    gamever,
    version,
  };
  const clients = [];
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    let signalJoinAccepted;
    const joinAccepted = new Promise((resolve) => {
      signalJoinAccepted = resolve;
    });
    const clientOpts = {
      ...opts,
      onJoinAccepted: signalJoinAccepted,
    };
    if (opts.attempts > 1 && opts.name && opts.cdkey) {
      const suffix = String(attempt);
      clientOpts.name = opts.name.slice(0, 30 - suffix.length) + suffix;
      // Per-client CD-key suffixes yield distinct GameSpy proofs/keyhashes.
      clientOpts.cdkey = `${opts.cdkey}${suffix}`;
      clientOpts.keyhash = keyHash(clientOpts.cdkey);
      if (opts.offlineProfile) {
        clientOpts.profileId =
          opts.profileId === 0 ? 0 : opts.profileId + attempt - 1;
      }
    }
    logger.info(
      `Starting mock ${attempt}/${opts.attempts}: ` +
        `name=${JSON.stringify(clientOpts.name)}, ` +
        `profileId=${clientOpts.profileId}, ` +
        `keyhash=${clientOpts.keyhash ?? "(none)"}`,
    );
    const clientLogger =
      opts.attempts > 1
        ? new Logger({
            hex: opts.hex,
            label: `C${attempt}`,
          })
        : logger;
    clients.push(
      doJoin(clientOpts, resolved, attempt, clientLogger).then((result) => {
        if (result.accepted) {
          clientLogger.info(`Mock ${attempt} connection ended.`);
        }
        return result;
      }),
    );
    if (attempt < opts.attempts) {
      if (opts.staggerMs === null) {
        await Promise.race([
          joinAccepted,
          new Promise((resolve) =>
            setTimeout(resolve, AUTO_STAGGER_CEILING_MS),
          ),
        ]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, opts.staggerMs));
      }
    }
  }
  await Promise.all(clients);
  logger.section("Done");
}
process.on("unhandledRejection", (err) => {
  console.error("[FATAL] Unhandled rejection:", err);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
  process.exit(1);
});
main();
