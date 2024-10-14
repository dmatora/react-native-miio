import { logger } from 'react-native-logs';

const log = logger.createLogger({
  severity: 'debug',
  transport: (msg: any) => {
    console.log(
      `[${msg.level.text}]${msg.extension ? `[${msg.extension}]` : ''}`,
      ...msg.rawMsg
    );
  },
  enabledExtensions: null,
});

export default log;
