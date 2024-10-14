# react-native-miio

[![npm version](https://img.shields.io/npm/v/react-native-miio)](https://www.npmjs.com/package/react-native-miio)

**react-native-miio** is a modified version of the original [`miio-api`](https://www.npmjs.com/package/miio-api) by Russtone, adapted for use in React Native environments.

The main goal of this project is to provide basic protocol functions for Xiaomi devices without making assumptions about specific devices, as there are many, and supporting all of them would be a challenging task.

## What's New in This Version

- Replaced `crypto` with `react-native-quick-crypto` for cryptographic functions.
- Replaced `dgram` with `react-native-udp` for UDP communication.
- Replaced `Buffer` with the `buffer` package for compatibility with React Native.
- Switched from `debug` to `react-native-logs` for logging.
- Bug fixes and improvements for mobile platforms.

## Installation

To install the package, run:

```sh
npm install react-native-miio
```

## Usage

### TypeScript Example

```typescript
import * as miio from "react-native-miio";

type Power = "on" | "off";
type Props = "power" | "humidity";

(async (): Promise<void> => {
  let device;

  try {
    device = await miio.device({
      address: "192.168.1.31",
      token: "93db466137accd4c9c6204315c542f9c",
    });

    const info = await device.call<Props[], [Power, number]>("get_prop", [
      "power",
      "humidity",
    ]);
    console.log(info);
  } catch (err) {
    console.error("ERROR: " + err);
  } finally {
    await device?.destroy();
  }
})();
```

### JavaScript Example

```javascript
const miio = require("react-native-miio");

(async () => {
  let device;

  try {
    device = await miio.device({
      address: "192.168.1.31",
      token: "93db466137accd4c9c6204315c542f9c",
    });

    const info = await device.call("get_prop", ["power"]);
    console.log(info);
  } catch (err) {
    console.error("ERROR: " + err);
  } finally {
    if (device) {
      await device.destroy();
    }
  }
})();
```

## Debugging

To enable debugging, you can configure `react-native-logs` in your code. Here’s how you can set up the logger and enable debug-level logging:

```typescript
import { logger } from 'react-native-miio';

// Enable debug-level logging
logger.setSeverity('debug');

(async (): Promise<void> => {
  let device;

  try {
    device = await miio.device({
      address: "192.168.1.31",
      token: "93db466137accd4c9c6204315c542f9c",
    });

    const info = await device.call("get_prop", ["power"]);
    console.log(info);
  } catch (err) {
    console.error("ERROR: " + err);
  } finally {
    await device?.destroy();
  }
})();
```

This example enables logging at the `debug` level for more detailed output. You can adjust the severity level to control what types of messages are logged (`debug`, `info`, `warn`, `error`, etc.).

### Sample Debug Output

```plaintext
[debug] {"extension": "qwvi9ty5"} Starting handshake
[debug] {"extension": "qwvi9ty5"} -> %O { id: 3204069188, method: 'get_prop', params: [ 'power' ] }
[debug] {"extension": "qwvi9ty5"} <- { result: [ 'off' ], id: 3204069188 }
```

## License

MIT License. See the `LICENSE` file for more details.
