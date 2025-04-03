import mitt from 'mitt';

const eventBus = mitt();
eventBus.once = (type, handler) => {
  const wrapper = (...args) => {
    eventBus.off(type, wrapper);
    handler(...args);
  };
  eventBus.on(type, wrapper);
};
  
export default eventBus;
