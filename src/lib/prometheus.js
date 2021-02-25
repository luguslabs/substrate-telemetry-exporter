const { register } = require('prom-client');
const promClient = require('prom-client');

const gauges = {};

module.exports = {
  startCollection: () =>{
    console.log('Starting the collection of metrics, the metrics are available on /metrics');
    promClient.collectDefaultMetrics();
  },

  injectMetricsRoute: (app) => {
    app.get('/metrics', (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(register.metrics());
    });
  },

  nodesGauge: (network, type) => {
    const gaugeName = `${network.toLowerCase()}_${type}_nodes`;
    if (gauges[gaugeName]) {
      return gauges[gaugeName];
    } else {
      gauges[gaugeName] = new promClient.Gauge({
        name: gaugeName,
        help: `Total number of ${type} nodes available on the ${network} network`
      });
      return gauges[gaugeName];
    }
  },
/*
  timeToFinality: new promClient.Histogram({
    name: 'polkadot_block_finality_seconds',
    help: 'Time from block production to block finalized',
    buckets: [10, 14, 18, 22, 26, 30]
  }),

  bestBlock: new promClient.Gauge({
    name: 'polkadot_best_block',
    help: 'Maximum height of the chain'
  }),

  bestFinalized: new promClient.Gauge({
    name: 'polkadot_best_finalized',
    help: 'Highest finalized block'
  }),

  blockProductionTime: new promClient.Histogram({
    name: 'polkadot_block_production_seconds',
    help: 'Time to produce a block as reported by telemetry'
  }),

  blockPropagationTime: new promClient.Histogram({
    name: 'polkadot_block_propagation_seconds',
    help: 'Time to receive a block as reported by telemetry',
    labelNames: ['node']
  }),
*/
}
