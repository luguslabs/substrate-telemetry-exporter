const ReconnectingWebSocket = require('reconnecting-websocket');
const WS = require('ws');

const { 
        nodesGauge,
      //  timeToFinality,
      //  bestBlock,
      //  bestFinalized,
      //  blockProductionTime,
      //  blockPropagationTime,
      } = require('./prometheus');

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
  AfgAuthoritySet      : 19
};

const DEFAULT_TELEMETRY_HOST = 'ws://localhost:8000/feed';

class Client {
  constructor(cfg) {
    this.cfg = cfg;

    this.currentSubscribedNetwork = "";

    const options = {
      WebSocket: WS, // custom WebSocket constructor
      connectionTimeout: 1000,
      maxRetries: 10,
    };
    
    this.address = cfg.telemetry_host || DEFAULT_TELEMETRY_HOST;
    this.socket = new ReconnectingWebSocket(this.address, [], options);
    this.timestamps = {};
    this.nodes = {};
  }

  start() {
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        console.log(`Conected to substrate-telemetry on ${this.address}`);
        this.cfg.subscribe.chains.forEach((chain) => {
          nodesGauge(chain, "validator");
          nodesGauge(chain, "passive");
          nodesGauge(chain, "other");
          this._subscribe(chain);
        });
        resolve();
      };

      this.socket.onclose = () => {
        console.log(`Conection to substrate-telemetry on ${this.address} closed`);
        reject();
      };

      this.socket.onerror = (err) => {
        console.log(`Could not connect to substrate-telemetry on ${this.address}: ${err}`);
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

    //console.log(`JSON data ${JSON.stringify(data)}`);

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

    case Actions.SubscribedTo:
      {
        const network = payload;
        this.currentSubscribedNetwork = network;
        console.log(`Listening for network ${network}`);
      }
      break;
    case Actions.AddedChain:
      {
        const chain = payload[0];
        this._subscribe(chain);
      }
      break;

    case Actions.AddedNode:
      {
        const nodeID = payload[0];
        const nodeName = payload[1][0];
        const nodeIdent = `${this.currentSubscribedNetwork}_${nodeID}`
        const nodeType = this.getNodeType(this.currentSubscribedNetwork, nodeName);

        if (!this.nodes[nodeIdent]) {
          nodesGauge(this.currentSubscribedNetwork, nodeType).inc();
          this.nodes[nodeIdent] = nodeName;
        }

        console.log(`New node ${nodeName} - ${nodeIdent} - ${nodeType}`);
      }
      break;

    case Actions.RemovedNode:
      {
        const nodeID = payload;
        const nodeIdent = `${this.currentSubscribedNetwork}_${nodeID}`
        const nodeName = this.nodes[nodeIdent];
        const nodeType = this.getNodeType(this.currentSubscribedNetwork, nodeName);

        console.log(`Removed Node Payload: ${JSON.stringify(payload)}`);

        if (this.nodes[nodeIdent]) {
          nodesGauge(this.currentSubscribedNetwork, nodeType).dec();
          delete this.nodes[nodeIdent];
        }

        console.log(`Node ${nodeIdent} - ${nodeName} - ${nodeType} departed`);
      }
      break;
/*
    case Actions.BestBlock:
      {
        const blockNumber = payload[0];

        bestBlock.set(blockNumber);

        const productionTime = payload[1];
        blockProductionTime.observe(productionTime);

        this.timestamps[blockNumber] = productionTime;

        console.log(`New best block ${blockNumber}`);
      }
      break;

    case Actions.ImportedBlock:
      {
        const blockNumber = payload[1][0];
        const nodeID = payload[0];
        const node = this.nodes[nodeID];

        const propagationTime = payload[1][4] / 1000;
        blockPropagationTime.observe({ node }, propagationTime);
        console.log(`propagationTime at node ${nodeID} : ${propagationTime}`);
        console.log(`Block ${blockNumber} imported at node ${nodeID}`);
      }
      break;

    case Actions.FinalizedBlock:
      {
        const blockNumber = payload[1];

        console.log(`New finalized block ${blockNumber}`)
      }
      break;

    case Actions.BestFinalized:
      {
        const blockNumber = payload[0];

        bestFinalized.set(blockNumber);

        const productionTime = this.timestamps[blockNumber];

        if (productionTime) {
          const finalityTime = (currentTimestamp - productionTime) / 1000;
          console.log(`finality time for ${blockNumber}: ${finalityTime}`)
          timeToFinality.observe(finalityTime);

          delete this.timestamps[blockNumber];
        }

        console.log(`New best finalized block ${blockNumber}`)
      }
      break;
*/
    }
  }

  _subscribe(chain) {
    if(this.cfg.subscribe.chains.includes(chain)) {
      this.socket.send(`subscribe:${chain}`);
      console.log(`Subscribed to chain '${chain}'`);

      this.socket.send(`send-finality:${chain}`);
      console.log('Requested finality data');
    }
  }

  getNodeType(chain, nodeName) {
    if (nodeName.includes(this.cfg[chain.toLowerCase()].active_node_pattern)) {
      return "validator"
    }
    if (nodeName.includes(this.cfg[chain.toLowerCase()].passive_node_pattern)) {
      return "passive"
    } 
    return "other"
  }
}

module.exports = {
  Client
}
