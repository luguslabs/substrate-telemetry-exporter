const ReconnectingWebSocket = require('reconnecting-websocket');
const WS = require('ws');
const debug = require('debug')('client');

const { Node } = require('./node');

const Actions = {
  FeedVersion      : 0,
  BestBlock        : 1,
  BestFinalized    : 2,
  AddedNode        : 3,
  RemovedNode      : 4,
  LocatedNode      : 5,
  ImportedBlock    : 6,
  FinalizedBlock   : 7,
  NodeStats        : 8,
  NodeHardware     : 9,
  TimeSync         : 10,
  AddedChain       : 11,
  RemovedChain     : 12,
  SubscribedTo     : 13,
  UnsubscribedFrom : 14,
  Pong             : 15,
  AfgFinalized         : 16,
  AfgReceivedPrevote   : 17,
  AfgReceivedPrecommit : 18,
  AfgAuthoritySet      : 19,
  StaleNode            : 20,
  NodeIO               : 21,

};

class Client {
  constructor(telemetryHost, chain, patterns, inactiveNodeTime) {

    const options = {
      WebSocket: WS,
      connectionTimeout: 1000,
      maxRetries: 10,
    };
    
    this.address = telemetryHost;
    this.socket = new ReconnectingWebSocket(this.address, [], options);
    this.timestamps = {};

    this.nodes = new Map();
    this.chains = new Map();
    this.chain = chain;
    this.patterns = patterns;
    this.inactiveNodeTime = inactiveNodeTime;
  }

  start() {

    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        console.log(`Conected to substrate-telemetry on ${this.address} for chain ${this.chain}`);
        this._subscribe(this.chain);
        resolve();
      };

      this.socket.onclose = () => {
        console.log(`Conection to substrate-telemetry on ${this.address} closed for chain ${this.chain}`);
        reject();
      };

      this.socket.onerror = (err) => {
        console.log(`Could not connect to substrate-telemetry on ${this.address}: ${err} for chain ${this.chain}`);
        reject();
      };

      this.socket.onmessage = (data) => {
        const currentTimestamp = Date.now();
        const messages = this._deserialize(data);
        
        for (let count = 0; count < messages.length; count++) {
          this._handle(messages[count], currentTimestamp);
        }
      };
    });
  }

  _deserialize(msg) {
    const data = JSON.parse(msg.data);

    debug('_deserialize',`JSON data ${JSON.stringify(data)}`);

    const messages = new Array(data.length / 2);

    for (const index of messages.keys()) {
      const [action, payload] = data.slice(index * 2);

      messages[index] = { action, payload };
    }
    return messages;
  }

  _handle(message, currentTimestamp) {
    const { action, payload } = message;

    switch(action) {

    case Actions.AddedChain:
      {
        const [label, nodeCount] = payload;
        const chain = this.chains.get(label);

        if (chain) {
          chain.nodeCount = nodeCount;
        } else {
          this.chains.set(label, { label, nodeCount });
        }

        debug('_handle',`Added Chain ${payload}`);
      }
      break;

    case Actions.RemovedChain:
      {
        this.chains.delete(payload);
        
        debug('_handle',`Removed Chain ${payload}`);
      }
      break;

    case Actions.SubscribedTo:
      {
        this.nodes.clear();

        const network = payload;
        console.log(`Listening for network ${network}`);

        debug('_handle',`SubscribedTo ${payload}`);
      }
      break;

    case Actions.AddedNode:
      {

        const [
          id,
          nodeDetails,
          nodeStats,
          nodeIO,
          nodeHardware,
          blockDetails,
          location,
          startupTime,
        ] = payload;

        const node = new Node(
          id,
          nodeDetails,
          nodeStats,
          nodeIO,
          nodeHardware,
          blockDetails,
          location,
          startupTime,
          this.patterns,
          this.inactiveNodeTime
        );

        this.nodes.set(id, node);
        
        console.log(`New node added to chain ${this.chain} with ID: ${id}`);

        debug('_handle',`Added Node ${payload}`);
      }
      break;

    case Actions.RemovedNode:
      {

        const id = payload;

        if (this.nodes.get(id)) {
          this.nodes.delete(id);
          console.log(`Node ${id} departed`);
        } else {
          console.log(`Error! Removed Node doesn't exist!`);
        }

        debug('_handle',`Removed Node ${payload}`);
      }
      break;

    case Actions.StaleNode: 
      {
        const id = payload;

        this.nodes.get(id).setStale(true);

        console.log(`Stale Node at chain ${this.chain} with id ${id}`);

        debug('_handle',`Stale Node ${payload}`);
      }
      break;

    case Actions.LocatedNode: 
      {
        const [id, lat, lon, city] = payload;

        this.nodes.get(id).updateLocation([lat, lon, city]);

        console.log(`Located Node at chain ${this.chain} with id ${id}`);

        debug('_handle',`Located Node ${payload}`);
      }
      break;

    case Actions.ImportedBlock: 
      {
        const [id, blockDetails] = payload;

        this.nodes.get(id).updateBlock(blockDetails);

        console.log(`Imported block at chain ${this.chain}`);

        debug('_handle',`Imported Block ${payload}`);
      }
      break;

    case Actions.FinalizedBlock: 
      {
        const [id, height, hash] = payload;

        this.nodes.get(id).updateFinalized(height, hash);

        console.log(`Finalied block at chain ${this.chain} with id ${height}`);

        debug('_handle',`Finalized Block ${payload}`);
      }
      break;

    case Actions.NodeStats: 
      {
        const [id, nodeStats] = payload;

        this.nodes.get(id).updateStats(nodeStats);

        console.log(`Node stats at chain ${this.chain} with id ${id}`);

        debug('_handle',`Node Stats ${payload}`);
      }
      break;

    case Actions.NodeHardware: 
      {
        const [id, nodeHardware] = payload;

        this.nodes.get(id).updateHardware(nodeHardware);

        console.log(`Node hardware at chain ${this.chain} with id ${id}`);

        debug('_handle',`Node Hardware ${payload}`);
      }
      break;

    case Actions.NodeIO: 
    {
        const [id, nodeIO] = payload;

        this.nodes.get(id).updateIO(nodeIO);

        console.log(`Node IO at chain ${this.chain} with id ${id}`);

        debug('_handle',`NodeIO ${payload}`);
      }
      break;
    }
  }

  _subscribe(chain) {
    this.socket.send(`subscribe:${chain}`);
    console.log(`Subscribed to chain '${chain}'`);
  }

}

module.exports = {
  Client
}
