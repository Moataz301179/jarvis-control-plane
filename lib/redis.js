import net from 'node:net';
import { config } from './config.js';

function encode(args) {
  return `*${args.length}\r\n${args.map((arg) => {
    const value = String(arg);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function parse(buffer) {
  let offset = 0;
  function readValue() {
    if (offset >= buffer.length) return undefined;
    const lineEnd = buffer.indexOf('\r\n', offset);
    if (lineEnd < 0) return undefined;
    const type = String.fromCharCode(buffer[offset]);
    const line = buffer.subarray(offset + 1, lineEnd).toString();
    offset = lineEnd + 2;
    if (type === '+') return line;
    if (type === '-') throw new Error(line);
    if (type === ':') return Number(line);
    if (type === '$') {
      const size = Number(line);
      if (size < 0) return null;
      if (buffer.length < offset + size + 2) return undefined;
      const value = buffer.subarray(offset, offset + size).toString();
      offset += size + 2;
      return value;
    }
    if (type === '*') {
      const count = Number(line);
      if (count < 0) return null;
      const values = [];
      for (let i = 0; i < count; i += 1) {
        const value = readValue();
        if (value === undefined) return undefined;
        values.push(value);
      }
      return values;
    }
    throw new Error(`Unsupported Redis response type: ${type}`);
  }
  const value = readValue();
  return value === undefined ? undefined : value;
}

export async function redisCommand(...args) {
  const url = new URL(config.redisUrl);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) });
    const chunks = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Redis command timed out'));
    }, 7000);
    const finish = (error, value) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(value);
    };
    socket.on('connect', () => {
      const prefix = url.pathname && url.pathname !== '/' ? encode(['SELECT', url.pathname.slice(1)]) : '';
      socket.write(prefix + encode(args));
    });
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      let offset = 0;
      try {
        if (url.pathname && url.pathname !== '/') {
          const selectEnd = buffer.indexOf('\r\n');
          if (selectEnd < 0) return;
          if (String.fromCharCode(buffer[0]) !== '+') throw new Error(`Redis SELECT failed: ${buffer.toString()}`);
          offset = selectEnd + 2;
        }
        const response = parse(buffer.subarray(offset));
        if (response !== undefined) finish(null, response);
      } catch (error) {
        finish(error);
      }
    });
    socket.on('error', (error) => finish(error));
  });
}

export const queueKey = 'jarvis:wake';
export async function signalQueue() {
  try {
    await redisCommand('LPUSH', queueKey, String(Date.now()));
  } catch (error) {
    console.warn('signalQueue: Redis wake signal failed; worker will poll:', String(error?.message || error).slice(0, 300));
  }
}

export async function waitForSignal(timeoutSeconds = 2) {
  return redisCommand('BRPOP', queueKey, String(timeoutSeconds));
}
