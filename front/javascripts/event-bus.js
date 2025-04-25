// event-bus.js

import mitt from 'mitt';

const emitter = mitt();

emitter.once = (type, handler) => {
  const onceHandler = (...args) => {
    emitter.off(type, onceHandler);
    handler(...args);
  };
  emitter.on(type, onceHandler);
};

export default emitter;
