const { register } = require('prom-client');
const promClient = require('prom-client');
const debug = require('debug')('prometheus');

class Prometheus {
  constructor(app) {
    this.app = app;
    this.chains = new Map();
    this.gauges = new Map();
  }

  startMetricsRoute() {
    console.log('Starting the collection of metrics, the metrics are available on /metrics');

    this.app.get('/metrics', (req, res) => {
      this.calculateMetrics();
      res.set('Content-Type', register.contentType);
      res.end(register.metrics());
    });

  }

  addChain(name, chainClient) {
    console.log(`Added network ${name} to Prometheus Exporter!`);

    this.chains.set(name, chainClient);
    
    this.nodesGauge(name, 'validator');
    this.nodesGauge(name, 'passive');
    this.nodesGauge(name, 'other');

  }

  addLabeledGauge(type, name) {
    if (this.gauges.get(type)) {
      return this.gauges.get(type).labels(name);
    } else {
      this.gauges.set(type, new promClient.Gauge({
        name: type,
        help: `nodes number`,
        labelNames: ['name'],
      }));
      return this.gauges.get(type).labels(name);
    }
  }

  nodesGauge(network, type) {
    const gaugeName = `${network.toLowerCase()}_${type}_nodes`;

    if (this.gauges.get(gaugeName)) {
      return this.gauges.get(gaugeName);
    } else {
      this.gauges.set(gaugeName, new promClient.Gauge({
        name: gaugeName,
        help: `Total number of ${type} nodes available on the ${network} network`
      }));
      return this.gauges.get(gaugeName);
    }
  }

  calculateMetrics(){
    
    this.chains.forEach((chain, chainName) => {
      const nodesCounters = new Map();
      const counters = new Map();

      chain.nodes.forEach((node) => {

        debug('calculateMetrics', `At Chain ${chainName} Found node ${node}`);

        if (!counters.get(node.getNodeType())) {
          counters.set(node.getNodeType(), 0);
        }

        if (!nodesCounters.get(node.name)) {
          nodesCounters.set(node.name, { type: node.getNodeType(), counter: 0});
        }

        if (node.isNodeAlive()) {
          nodesCounters.set(node.name, { type: node.getNodeType(), counter: nodesCounters.get(node.name).counter + 1});
          counters.set(node.getNodeType(), counters.get(node.getNodeType()) + 1);
        }

      });

      nodesCounters.forEach(({counter, type}, nodeName) => {
        this.addLabeledGauge(type, nodeName).set(counter);
      });

      counters.forEach((counter, nodeType) => {
        this.nodesGauge(chainName, nodeType).set(counter);
      });

    });
  }
}

module.exports = {
  Prometheus
}
